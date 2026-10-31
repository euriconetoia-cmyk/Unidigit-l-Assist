// Leitura e validação do CSV de perguntas (pergunta; opcao1..4; correta). Ideia do fluxo: projeto "SENAI Extensões" (Julio Alves, MIT), reescrita aqui.
(function (root) {
  'use strict';
  const KHT = root.KHT;
  const LIMITE_PERGUNTA = 120;
  const LIMITE_OPCAO = 75;
  const MODELO = 'pergunta;opcao1;opcao2;opcao3;opcao4;correta\nQual é a capital de Goiás?;Goiânia;Anápolis;Brasília;Rio Verde;1\nO que é um DNS?;Tradutor de nomes em endereços IP;Um tipo de cabo;Um antivírus;Um navegador;A\n';
  const HEADERS = {
    question: ['pergunta', 'questao', 'enunciado', 'question'],
    answers: [['opcao1', 'alternativa1', 'resposta1', 'answer1', 'option1', 'a'], ['opcao2', 'alternativa2', 'resposta2', 'answer2', 'option2', 'b'], ['opcao3', 'alternativa3', 'resposta3', 'answer3', 'option3', 'c'], ['opcao4', 'alternativa4', 'resposta4', 'answer4', 'option4', 'd']],
    correct: ['correta', 'correto', 'respostacorreta', 'alternativacorreta', 'correct', 'gabarito']
  };
  const norm = v => String(v == null ? '' : v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

  // CSV com ; , ou TAB (detecta pela primeira linha), aspas duplas e BOM.
  function parseDelimited(text) {
    let t = String(text == null ? '' : text).replace(/^﻿/, '');
    const first = t.split(/\r?\n/, 1)[0];
    const count = ch => (first.match(new RegExp(ch === '\t' ? '\t' : `\\${ch}`, 'g')) || []).length;
    const delim = [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0];
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < t.length; i += 1) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i += 1; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  const col = (headers, aliases) => { const ok = aliases.map(norm); return headers.findIndex(h => ok.includes(norm(h))); };
  function resolveCorrect(raw, answers) {
    const v = norm(raw);
    const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
    if (Object.prototype.hasOwnProperty.call(map, v)) return map[v];
    return v ? answers.findIndex(a => norm(a) === v) : -1;
  }

  // Devolve { questions:[válidas], linhas:[{linha, pergunta, correta, ok, erros}], erros:n }. Só lança se faltar coluna ou o arquivo estiver vazio.
  function parseQuestions(text) {
    const rows = parseDelimited(text);
    if (rows.length < 2) throw new Error('O arquivo precisa ter o cabeçalho e pelo menos uma pergunta.');
    const h = rows[0];
    const ix = { q: col(h, HEADERS.question), a: HEADERS.answers.map(x => col(h, x)), c: col(h, HEADERS.correct) };
    if (ix.q < 0 || ix.a.some(i => i < 0) || ix.c < 0) throw new Error('Use as colunas: pergunta, opcao1, opcao2, opcao3, opcao4 e correta.');
    const questions = []; const linhas = [];
    rows.slice(1).forEach((r, off) => {
      if (!r.some(x => clean(x))) return;
      const linha = off + 2;
      const question = clean(r[ix.q]);
      const answers = ix.a.map(i => clean(r[i]));
      const correctIndex = resolveCorrect(r[ix.c], answers);
      const erros = [];
      if (!question) erros.push('pergunta vazia'); else if (question.length > LIMITE_PERGUNTA) erros.push(`pergunta com mais de ${LIMITE_PERGUNTA} caracteres`);
      const vazias = answers.map((a, i) => (a ? 0 : i + 1)).filter(Boolean);
      if (vazias.length) erros.push(vazias.length === 1 ? `opção ${vazias[0]} vazia` : `só ${4 - vazias.length} opções`);
      answers.forEach((a, i) => { if (a.length > LIMITE_OPCAO) erros.push(`opção ${i + 1} com mais de ${LIMITE_OPCAO} caracteres`); });
      if (correctIndex < 0) erros.push('falta a correta');
      linhas.push({ linha, pergunta: question, correta: correctIndex < 0 ? '' : `${'ABCD'[correctIndex]} · ${answers[correctIndex] || ''}`, ok: !erros.length, erros });
      if (!erros.length) questions.push({ question, answers, correctIndex, line: linha });
    });
    if (!linhas.length) throw new Error('Nenhuma pergunta encontrada abaixo do cabeçalho.');
    return { questions, linhas, erros: linhas.filter(l => !l.ok).length };
  }
  KHT.parse = { parseDelimited, parseQuestions, MODELO, LIMITE_PERGUNTA, LIMITE_OPCAO };
})(globalThis);
