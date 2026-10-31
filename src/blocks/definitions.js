// Definições dos blocos próprios, caixa de ferramentas e programas de exemplo (JSON do Blockly).
import * as Blockly from 'blockly/core';

const IMN_COLOUR = 210;

export const BLOCK_DEFINITIONS = [
  { type: 'hub_inicio', message0: 'Quando clicar em Executar %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: 120, tooltip: 'Tudo o que estiver encaixado aqui roda quando você clicar em Executar. Nada roda sozinho.' },
  { type: 'hub_esperar', message0: 'esperar %1 segundos', args0: [{ type: 'input_value', name: 'SEGUNDOS', check: 'Number' }], previousStatement: null, nextStatement: null, colour: 120, inputsInline: true, tooltip: 'Pausa o programa. Parar interrompe a espera.' },
  { type: 'hub_registrar', message0: 'registrar %1', args0: [{ type: 'input_value', name: 'TEXTO' }], previousStatement: null, nextStatement: null, colour: 230, inputsInline: true, tooltip: 'Escreve uma linha no registro de execução.' },
  { type: 'imn_buscar', message0: 'Importar Notas: buscar pendências', previousStatement: null, nextStatement: null, colour: IMN_COLOUR, tooltip: 'Faz a mesma busca da lupa (lê o Moodle da aba ativa, curso ou categoria).' },
  { type: 'imn_baixar', message0: 'Importar Notas: baixar pendentes', previousStatement: null, nextStatement: null, colour: IMN_COLOUR, tooltip: 'Inicia o download dos pendentes. A confirmação continua na página: o bloco não confirma por você.' },
  { type: 'imn_abrir_lote', message0: 'Importar Notas: abrir lançamento de notas (CSV)', previousStatement: null, nextStatement: null, colour: IMN_COLOUR, tooltip: 'Abre a janela de lançamento de notas. A prévia e a confirmação continuam sendo suas.' },
  { type: 'imn_total', message0: 'total de pendências', output: 'Number', colour: IMN_COLOUR, tooltip: 'Total encontrado pela última busca deste programa.' },
  { type: 'imn_parcial', message0: 'a busca ficou parcial', output: 'Boolean', colour: IMN_COLOUR, tooltip: 'Verdadeiro se alguma atividade não pôde ser verificada (o total é parcial).' },
  { type: 'imn_pagina', message0: 'tipo da página (curso, categoria ou outra)', output: 'String', colour: IMN_COLOUR, tooltip: 'Lê o tipo da página da aba ativa.' }
];

export function registerBlocks() {
  Blockly.common.defineBlocksWithJsonArray(BLOCK_DEFINITIONS);
}

const block = (type, extra = {}) => ({ kind: 'block', type, ...extra });
const num = n => ({ shadow: { type: 'math_number', fields: { NUM: n } } });

export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: 'Início', colour: '120', contents: [block('hub_inicio'), block('hub_esperar', { inputs: { SEGUNDOS: num(2) } }), block('hub_registrar', { inputs: { TEXTO: { shadow: { type: 'text', fields: { TEXT: 'olá' } } } } })] },
    { kind: 'category', name: 'Importar Notas', colour: String(IMN_COLOUR), contents: [block('imn_buscar'), block('imn_baixar'), block('imn_abrir_lote'), block('imn_total'), block('imn_parcial'), block('imn_pagina')] },
    { kind: 'category', name: 'Controle', colour: '210', contents: [block('controls_if'), block('controls_repeat_ext', { inputs: { TIMES: num(3) } })] },
    { kind: 'category', name: 'Lógica', colour: '210', contents: [block('logic_compare'), block('logic_operation'), block('logic_negate'), block('logic_boolean')] },
    { kind: 'category', name: 'Matemática', colour: '230', contents: [block('math_number'), block('math_arithmetic')] },
    { kind: 'category', name: 'Texto', colour: '160', contents: [block('text'), block('text_join')] }
  ]
};

let seq = 0;
const id = () => `ex${++seq}`;
const startWith = (y, ...blocks) => {
  for (let i = 0; i < blocks.length - 1; i += 1) blocks[i].next = { block: blocks[i + 1] };
  return { type: 'hub_inicio', id: id(), x: 24, y, inputs: { DO: { block: blocks[0] } } };
};
const txt = text => ({ shadow: { type: 'text', id: id(), fields: { TEXT: text } } });
const number = n => ({ shadow: { type: 'math_number', id: id(), fields: { NUM: n } } });
const imn = type => ({ type, id: id() });

export const EXAMPLES = {
  'Buscar pendências e registrar o total': () => ({ blocks: { languageVersion: 0, blocks: [startWith(24,
    imn('imn_buscar'),
    { type: 'hub_registrar', id: id(), inputs: { TEXTO: { block: { type: 'text_join', id: id(), extraState: { itemCount: 2 }, inputs: { ADD0: txt('Pendências: '), ADD1: { block: imn('imn_total') } } } } } }
  )] } }),
  'Buscar e, se houver pendência, baixar': () => ({ blocks: { languageVersion: 0, blocks: [startWith(24,
    imn('imn_buscar'),
    { type: 'controls_if', id: id(), inputs: {
      IF0: { block: { type: 'logic_compare', id: id(), fields: { OP: 'GT' }, inputs: { A: { block: imn('imn_total') }, B: number(0) } } },
      DO0: { block: imn('imn_baixar') } } },
    { type: 'hub_registrar', id: id(), inputs: { TEXTO: txt('Fim. Se o download começou, confirme na página.') } }
  )] } }),
  'Abrir o lançamento de notas (CSV)': () => ({ blocks: { languageVersion: 0, blocks: [startWith(24, imn('imn_abrir_lote'))] } })
};
