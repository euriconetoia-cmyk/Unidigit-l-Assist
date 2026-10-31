// Executor de blocos: percorre o JSON de Blockly.serialization.workspaces.save() e chama ações.
// Sem DOM, sem Blockly, sem eval/Function (o MV3 proíbe e rules.md também).

export const DEFAULT_LIMITS = Object.freeze({ maxSteps: 2000, maxRepeat: 200, maxWaitMs: 120000, maxTotalWaitMs: 600000 });

export class StopError extends Error {
  constructor() { super('Execução interrompida.'); this.name = 'StopError'; }
}
export class BlockError extends Error {
  constructor(message, block) { super(message); this.name = 'BlockError'; this.blockId = block && block.id; this.blockType = block && block.type; }
}

const START_TYPE = 'hub_inicio';

function topBlocks(workspace) {
  const blocks = (workspace && workspace.blocks && workspace.blocks.blocks) || [];
  return blocks.slice().sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
}

export function findStarts(workspace) {
  return topBlocks(workspace).filter(b => b.type === START_TYPE);
}

const defaultSleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal && signal.aborted) return reject(new StopError());
  const timer = setTimeout(() => { if (signal) signal.removeEventListener('abort', onAbort); resolve(); }, ms);
  const onAbort = () => { clearTimeout(timer); reject(new StopError()); };
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
});

/**
 * @param {object} workspace JSON do Blockly
 * @param {object} actions   { [tipoDeBloco]: async (valores, contexto) => valor } (blocos de módulo)
 * @param {object} options   { signal, log(entry), onBlock(id), sleep(ms, signal), limits }
 * @returns {Promise<{status:'ok'|'parado'|'erro', steps:number, message?:string, blockId?:string}>}
 */
export async function run(workspace, actions = {}, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const signal = options.signal;
  const sleep = options.sleep || defaultSleep;
  const log = options.log || (() => {});
  const onBlock = options.onBlock || (() => {});
  let steps = 0;
  let waited = 0;

  const state = { variables: new Map() };
  const ctx = { log, signal, state };

  const check = block => {
    if (signal && signal.aborted) throw new StopError();
    steps += 1;
    if (steps > limits.maxSteps) throw new BlockError(`Limite de ${limits.maxSteps} passos atingido: o programa foi interrompido para não ficar rodando sem fim.`, block);
    onBlock(block && block.id);
  };

  const valueBlock = (block, name) => {
    const input = block.inputs && block.inputs[name];
    return input ? (input.block || input.shadow || null) : null;
  };

  async function value(block, name, required = true) {
    const inner = valueBlock(block, name);
    if (!inner) {
      if (required) throw new BlockError('Falta encaixar um bloco de valor aqui.', block);
      return undefined;
    }
    return evaluate(inner);
  }

  const toNumber = (v, block) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) throw new BlockError(`"${v}" não é um número.`, block);
    return n;
  };

  async function evaluate(block) {
    check(block);
    const f = block.fields || {};
    switch (block.type) {
      case 'math_number': return Number(f.NUM);
      case 'text': return String(f.TEXT ?? '');
      case 'logic_boolean': return f.BOOL === 'TRUE';
      case 'logic_negate': return !(await value(block, 'BOOL'));
      case 'logic_operation': {
        const a = Boolean(await value(block, 'A'));
        if (f.OP === 'AND') return a ? Boolean(await value(block, 'B')) : false;
        return a ? true : Boolean(await value(block, 'B'));
      }
      case 'logic_compare': {
        const a = await value(block, 'A'); const b = await value(block, 'B');
        switch (f.OP) {
          case 'EQ': return a === b;
          case 'NEQ': return a !== b;
          case 'LT': return toNumber(a, block) < toNumber(b, block);
          case 'LTE': return toNumber(a, block) <= toNumber(b, block);
          case 'GT': return toNumber(a, block) > toNumber(b, block);
          case 'GTE': return toNumber(a, block) >= toNumber(b, block);
          default: throw new BlockError(`Comparação desconhecida: ${f.OP}.`, block);
        }
      }
      case 'math_arithmetic': {
        const a = toNumber(await value(block, 'A'), block); const b = toNumber(await value(block, 'B'), block);
        if (f.OP === 'ADD') return a + b;
        if (f.OP === 'MINUS') return a - b;
        if (f.OP === 'MULTIPLY') return a * b;
        if (f.OP === 'DIVIDE') { if (b === 0) throw new BlockError('Divisão por zero.', block); return a / b; }
        throw new BlockError(`Operação desconhecida: ${f.OP}.`, block);
      }
      case 'text_join': {
        const count = (block.extraState && block.extraState.itemCount) || Object.keys(block.inputs || {}).length;
        let out = '';
        for (let i = 0; i < count; i += 1) { const v = await value(block, `ADD${i}`, false); out += v === undefined || v === null ? '' : String(v); }
        return out;
      }
      default: {
        if (actions[block.type]) return callAction(block);
        throw new BlockError(`Este bloco ainda não é suportado pelo executor: ${block.type}.`, block);
      }
    }
  }

  async function callAction(block) {
    const values = {};
    for (const name of Object.keys(block.inputs || {})) values[name] = await value(block, name, false);
    try {
      return await actions[block.type](values, { ...ctx, fields: block.fields || {}, block });
    } catch (error) {
      if (error instanceof StopError || error instanceof BlockError) throw error;
      throw new BlockError(error && error.message ? error.message : String(error), block);
    }
  }

  async function statements(first) {
    let block = first;
    while (block) {
      await exec(block);
      block = block.next && block.next.block;
    }
  }

  const branch = (block, name) => (block.inputs && block.inputs[name] && block.inputs[name].block) || null;

  async function exec(block) {
    check(block);
    const f = block.fields || {};
    switch (block.type) {
      case START_TYPE: return statements(branch(block, 'DO'));
      case 'controls_if': {
        const state = block.extraState || {};
        const elseIf = Number(state.elseIfCount || 0);
        for (let i = 0; i <= elseIf; i += 1) {
          if (await value(block, `IF${i}`)) return statements(branch(block, `DO${i}`));
        }
        if (state.hasElse) return statements(branch(block, 'ELSE'));
        return undefined;
      }
      case 'controls_repeat_ext': {
        const times = toNumber(await value(block, 'TIMES'), block);
        if (times > limits.maxRepeat) throw new BlockError(`Repetir ${times} vezes passa do limite de ${limits.maxRepeat}.`, block);
        for (let i = 0; i < times; i += 1) await statements(branch(block, 'DO'));
        return undefined;
      }
      case 'hub_esperar': {
        const seconds = toNumber(await value(block, 'SEGUNDOS'), block);
        const ms = Math.max(0, seconds) * 1000;
        if (ms > limits.maxWaitMs) throw new BlockError(`Esperar ${seconds} s passa do limite de ${limits.maxWaitMs / 1000} s por bloco.`, block);
        waited += ms;
        if (waited > limits.maxTotalWaitMs) throw new BlockError('O tempo total de espera passou do limite do programa.', block);
        await sleep(ms, signal);
        return undefined;
      }
      case 'hub_registrar': {
        const text = await value(block, 'TEXTO', false);
        log({ level: 'info', text: text === undefined || text === null ? '' : String(text), blockId: block.id });
        return undefined;
      }
      default: {
        if (actions[block.type]) { await callAction(block); return undefined; }
        throw new BlockError(`Este bloco ainda não é suportado pelo executor: ${block.type}.`, block);
      }
    }
  }

  try {
    const starts = findStarts(workspace);
    if (!starts.length) throw new BlockError('Adicione o bloco "Quando clicar em Executar" e encaixe os outros blocos nele.', null);
    for (const start of starts) await exec(start);
    return { status: 'ok', steps };
  } catch (error) {
    if (error instanceof StopError) return { status: 'parado', steps, message: error.message };
    if (error instanceof BlockError) return { status: 'erro', steps, message: error.message, blockId: error.blockId };
    return { status: 'erro', steps, message: error && error.message ? error.message : String(error) };
  }
}
