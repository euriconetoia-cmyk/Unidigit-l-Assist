// Injeção sob demanda dos módulos e chamada de comandos na página.
export const MODULE_PATHS = {
  'importar-notas': { global: 'HUB_IMN', base: 'modules/importar-notas/', prefix: 'modules/importar-notas/vendor/', bridge: 'modules/importar-notas/bridge.js', manifest: 'modules/importar-notas/vendor/files.json' },
  alunos: { global: 'HUB_ALN', base: 'modules/alunos/', prefix: 'modules/alunos/', bridge: 'modules/alunos/bridge.js', manifest: 'modules/alunos/files.json' },
  kahoot: { global: 'HUB_KHT', base: 'modules/kahoot/', prefix: 'modules/kahoot/', bridge: 'modules/kahoot/bridge.js', manifest: 'modules/kahoot/files.json' }
};

export function createModuleHost(chromeApi, { fetchJson } = {}) {
  const loadList = async module => {
    const url = chromeApi.runtime.getURL(MODULE_PATHS[module].manifest);
    return fetchJson ? fetchJson(url) : (await fetch(url)).json();
  };

  async function ensureInjected(tabId, module) {
    const meta = MODULE_PATHS[module];
    if (!meta) throw new Error(`Módulo desconhecido: ${module}`);
    const [probe] = await chromeApi.scripting.executeScript({ target: { tabId }, func: name => Boolean(globalThis[name]), args: [meta.global] });
    if (probe && probe.result) return false;
    const list = await loadList(module);
    const prefix = meta.prefix;
    if (list.css && list.css.length) await chromeApi.scripting.insertCSS({ target: { tabId }, files: list.css.map(f => prefix + f) });
    await chromeApi.scripting.executeScript({ target: { tabId }, files: [...list.scripts.map(f => prefix + f), meta.bridge] });
    return true;
  }

  async function call(tabId, module, command, args = {}) {
    await ensureInjected(tabId, module);
    const meta = MODULE_PATHS[module];
    const [out] = await chromeApi.scripting.executeScript({
      target: { tabId },
      func: async (name, cmd, a) => {
        try { return { ok: true, value: await globalThis[name].run(cmd, a) }; } catch (error) { return { ok: false, error: error && error.message ? error.message : String(error) }; }
      },
      args: [meta.global, command, args]
    });
    const result = out && out.result;
    if (!result) throw new Error('A página não respondeu. Recarregue a página do Moodle e tente de novo.');
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  return { ensureInjected, call };
}
