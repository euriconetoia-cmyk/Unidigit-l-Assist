// Janela "Importar perguntas" no editor do Kahoot: escolher o CSV, conferir linha a linha, preencher com progresso e Cancelar.
// O arquivo é lido aqui mesmo, no navegador; nada é enviado. Todo texto do arquivo entra no DOM por textContent.
(function (root) {
  'use strict';
  const KHT = root.KHT;
  const HOST_ID = 'hub-kht-host';
  const BTN_ID = 'hub-kht-botao';
  const CSS = `
:host{all:initial}*{box-sizing:border-box}
.back{position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,35,.55);display:grid;place-items:center;padding:16px;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#14202e;--p:#0b5cad;--m:#5b6b7c;--bd:#dbe3ec;--s:#fff;--c:#f8fafd;--ok:#157a4c;--okbg:#e1f5ec;--wn:#a86400;--wnbg:#fff3d6;--er:#b3261e;--erbg:#fde8e5;--f:#f6b900}
@media (prefers-color-scheme:dark){.back{color:#e6ecf5;--m:#9aa8bd;--bd:#2b3646;--s:#1a212c;--c:#212a37;--okbg:#143a2b;--ok:#6fd0a0;--wnbg:#3a2f12;--wn:#f0c36a;--erbg:#3d1d1a;--er:#f2a29b}}
.box{width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--s);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
h2{margin:0 0 2px;font-size:18px}.sub{color:var(--m);font-size:12.5px;margin:0 0 10px}
.drop{display:block;border:2px dashed var(--bd);border-radius:12px;padding:18px;text-align:center;background:var(--c);cursor:pointer}.drop b{display:block}.drop span{color:var(--m);font-size:12.5px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}th{background:var(--c);text-align:left;padding:5px 8px}td{padding:5px 8px;border-bottom:1px solid var(--bd);vertical-align:top}
.ok{color:var(--ok);font-weight:600}.er{color:var(--er);font-weight:600}
.row2{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}.sp{flex:1}
button,a.btn{font:inherit;min-height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:inherit;cursor:pointer}
button.pri{background:var(--p);border-color:var(--p);color:#fff}button:disabled{opacity:.5;cursor:default}
button:focus-visible,input:focus-visible{outline:3px solid var(--f);outline-offset:2px}
.msg{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:13px;background:var(--c)}.msg.warn{background:var(--wnbg);color:var(--wn)}.msg.ok{background:var(--okbg);color:var(--ok)}.msg.err{background:var(--erbg);color:var(--er)}
.prog{height:10px;border-radius:6px;background:var(--bd);overflow:hidden;margin:8px 0}.prog i{display:block;height:100%;background:var(--p);width:0;transition:width .3s}
.dock{position:fixed;right:16px;bottom:16px;z-index:2147483200;width:min(340px,calc(100vw - 32px));background:var(--s);color:#14202e;border:1px solid var(--bd);border-radius:12px;padding:12px 14px;box-shadow:0 12px 40px rgba(0,0,0,.35);font:14px/1.4 system-ui,sans-serif;--p:#0b5cad;--bd:#dbe3ec;--s:#fff;--m:#5b6b7c;--okbg:#e1f5ec;--ok:#157a4c;--erbg:#fde8e5;--er:#b3261e}
.fld{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px}
.abre{all:unset;box-sizing:border-box;cursor:pointer;padding:9px 16px;border-radius:8px;background:#46178f;color:#fff;font:600 14px system-ui,sans-serif;box-shadow:0 2px 0 rgba(0,0,0,.25)}.abre:focus-visible{outline:3px solid #f6b900;outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}`;

  function h(tag, props = {}, ...kids) {
    const n = root.document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
    kids.flat().forEach(c => { if (c != null && c !== false) n.append(c.nodeType ? c : root.document.createTextNode(String(c))); });
    return n;
  }
  const fmt = s => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  const running = { value: false };
  const trocar = (node, ...kids) => node.replaceChildren(...kids.flat().filter(k => k != null && k !== false)); // null não vira texto "null"

  function open() {
    if (running.value) return;
    const old = root.document.getElementById(HOST_ID); if (old) old.remove();
    const host = h('div', { id: HOST_ID }); host.style.cssText = 'all:initial';
    const shadow = host.attachShadow({ mode: 'open' }); shadow.append(h('style', {}, CSS));
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Importar perguntas no Kahoot' });
    const back = h('div', { class: 'back', onclick: e => { if (e.target === back) close(); } }, box);
    shadow.append(back); root.document.documentElement.append(host);
    const close = () => host.remove();
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    const st = { arquivo: null, parsed: null, erro: '', usarEmBranco: true };

    function telaArquivo() {
      const input = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', hidden: true });
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0]; if (!f) return;
        st.arquivo = f; st.erro = ''; st.parsed = null;
        try { st.parsed = KHT.parse.parseQuestions(await f.text()); telaConferir(); } catch (e) { st.erro = e.message; telaArquivo(); }
      });
      const drop = h('label', { class: 'drop' }, h('b', {}, st.arquivo ? st.arquivo.name : 'Escolher o arquivo CSV'), h('span', {}, 'colunas: pergunta, opcao1, opcao2, opcao3, opcao4, correta'), input);
      trocar(box, h('h2', {}, 'Importar perguntas'), h('p', { class: 'sub' }, 'O arquivo é lido aqui, no seu navegador. Nada é enviado.'), drop,
        st.erro ? h('div', { class: 'msg err', role: 'alert' }, st.erro) : null,
        h('div', { class: 'row2' }, h('span', { class: 'sp' }), h('button', { type: 'button', onclick: close }, 'Cancelar')));
      drop.focus();
    }

    function telaConferir() {
      const p = st.parsed; const prontas = p.questions.length; const diag = KHT.filler.diagnostico();
      const importar = lista => { close(); rodar(lista, st.usarEmBranco); };
      const chk = h('input', { type: 'checkbox', id: 'brc', checked: true, onchange: e => { st.usarEmBranco = e.target.checked; } });
      trocar(box, h('h2', {}, 'Conferir antes de preencher'),
        h('p', { class: 'sub' }, `${p.linhas.length} linha(s) lida(s) de ${st.arquivo ? st.arquivo.name : 'arquivo'}: ${prontas} pronta(s)${p.erros ? `, ${p.erros} com problema` : ''}.`),
        h('table', {}, h('thead', {}, h('tr', {}, ['#', 'Pergunta', 'Correta', ''].map(t => h('th', {}, t)))),
          h('tbody', {}, p.linhas.map((l, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, l.pergunta.length > 70 ? `${l.pergunta.slice(0, 70)}…` : l.pergunta), h('td', {}, l.correta || '—'), h('td', { class: l.ok ? 'ok' : 'er' }, l.ok ? 'ok' : l.erros.join('; ')))))),
        diag.pronto ? null : h('div', { class: 'msg warn' }, `O editor ainda não está pronto (falta ${diag.falta.join(', ')}). Abra uma pergunta do tipo Quiz antes de importar.`),
        h('label', { class: 'fld' }, chk, 'Usar a pergunta em branco atual como primeira'),
        h('div', { class: 'row2' },
          h('button', { type: 'button', onclick: telaArquivo }, 'Voltar'), h('span', { class: 'sp' }),
          p.erros && prontas ? h('button', { type: 'button', disabled: !diag.pronto, onclick: () => importar(p.questions) }, `Importar só as válidas (${prontas})`) : null,
          h('button', { type: 'button', class: 'pri', disabled: !diag.pronto || p.erros > 0 || !prontas, onclick: () => importar(p.questions) }, 'Importar tudo')));
    }
    telaArquivo();
  }

  async function rodar(questions, usarEmBranco) {
    running.value = true;
    const ctl = new root.AbortController(); const t0 = Date.now();
    const host = h('div', { id: `${HOST_ID}-prog` }); host.style.cssText = 'all:initial';
    const sh = host.attachShadow({ mode: 'open' }); sh.append(h('style', {}, CSS));
    const titulo = h('b', {}, 'Preenchendo…'); const barra = h('i'); const linha = h('div', { role: 'status', 'aria-live': 'polite' }, `0 de ${questions.length}`);
    const cancelar = h('button', { type: 'button', onclick: () => { ctl.abort(); titulo.textContent = 'Cancelando…'; } }, 'Cancelar');
    const dock = h('section', { class: 'dock', 'aria-label': 'Progresso da importação' }, titulo, linha, h('div', { class: 'prog' }, barra), h('div', { class: 'row2', style: 'margin-top:4px' }, cancelar));
    sh.append(dock); root.document.documentElement.append(host);
    const tempo = setInterval(() => { if (barra.isConnected) linha.dataset.t = fmt(Math.floor((Date.now() - t0) / 1000)); }, 500);
    const fim = (tipo, texto) => {
      clearInterval(tempo); running.value = false; titulo.textContent = tipo === 'ok' ? 'Importação concluída' : tipo === 'cancel' ? 'Importação cancelada' : 'Importação interrompida';
      linha.textContent = texto; linha.className = tipo === 'ok' ? 'msg ok' : 'msg err'; cancelar.textContent = 'Fechar'; cancelar.onclick = () => host.remove(); cancelar.focus();
    };
    try {
      const r = await KHT.filler.executar(questions, { usarEmBranco, signal: ctl.signal, onProgress: (feitas, total, txt) => { barra.style.width = `${Math.round(feitas / total * 100)}%`; linha.textContent = `${feitas} de ${total}${txt ? ` · ${txt}` : ''} · ${fmt(Math.floor((Date.now() - t0) / 1000))}`; } });
      barra.style.width = '100%'; fim('ok', `${r.feitas} pergunta(s) preenchida(s) em ${fmt(Math.floor((Date.now() - t0) / 1000))}. Confira o quiz e salve no Kahoot.`);
    } catch (e) {
      const parcial = e.feitas ? ` ${e.feitas} pergunta(s) já foram preenchidas.` : '';
      if (e.name === 'Cancelado') fim('cancel', `Parou a pedido.${parcial} O quiz ficou como está: confira antes de continuar.`);
      else fim('erro', `${e.message}${parcial} O quiz pode estar incompleto: confira no Kahoot.`);
    }
  }

  // Botão "Importar!" no editor (ao lado do Add, se achar; senão flutuante). Só aparece depois que o usuário abriu a ferramenta.
  function garantirBotao() {
    if (root.document.getElementById(BTN_ID)) return;
    const host = h('div', { id: BTN_ID }); host.style.cssText = 'display:inline-block;margin-left:8px;vertical-align:middle';
    const sh = host.attachShadow({ mode: 'open' }); sh.append(h('style', {}, CSS), h('button', { type: 'button', class: 'abre', onclick: open }, 'Importar!'));
    const add = root.document.querySelector('[data-functional-selector="add-question-button"]');
    if (add && add.parentElement) add.insertAdjacentElement('afterend', host);
    else { host.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483100'; root.document.documentElement.append(host); }
  }
  KHT.ui = { open, garantirBotao, HOST_ID, BTN_ID };
})(globalThis);
