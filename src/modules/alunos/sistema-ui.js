// Telas do sistema: Compatibilidade, Meus dados e Sobre. Só abrem quando o usuário clica; nada é enviado para fora.
// Todo texto vai ao DOM por textContent. Backup/Importar usam arquivo local.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const HOST_ID = 'hub-aln-sistema';
  const REPO = 'https://github.com/euriconetoia-cmyk/Unidigit-l-Assist';
  const CSS = `
:host{all:initial}*{box-sizing:border-box}
.back{position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,35,.5);display:grid;place-items:center;padding:16px;font:14px/1.4 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;color:#14202e;--p:#0b5cad;--m:#5b6b7c;--bd:#dbe3ec;--s:#fff;--c:#f8fafd;--ok:#157a4c;--okbg:#e1f5ec;--wn:#a86400;--wnbg:#fff3d6;--er:#b3261e;--erbg:#fde8e5;--f:#f6b900}
@media (prefers-color-scheme:dark){.back{color:#e6ecf5;--m:#9aa8bd;--bd:#2b3646;--s:#1a212c;--c:#212a37;--okbg:#143a2b;--ok:#6fd0a0;--wnbg:#3a2f12;--wn:#f0c36a;--erbg:#3d1d1a;--er:#f2a29b}}
.box{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--s);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
h2{margin:0 0 2px;font-size:18px}.sub{color:var(--m);font-size:12.5px;margin:0 0 10px}
.it{display:flex;gap:10px;align-items:center;border:1px solid var(--bd);background:var(--c);border-radius:10px;padding:7px 10px;margin-top:6px}.it b{flex:1;font-weight:600}.it small{color:var(--m)}
.pill{font-size:12px;padding:1px 9px;border-radius:999px;background:var(--bd);color:var(--m);white-space:nowrap}.pill.ok{background:var(--okbg);color:var(--ok)}.pill.aviso{background:var(--wnbg);color:var(--wn)}.pill.falha{background:var(--erbg);color:var(--er)}
.bar{height:9px;border-radius:5px;background:var(--bd);overflow:hidden;margin:8px 0 2px}.bar i{display:block;height:100%;background:var(--p)}.bar.hot i{background:var(--wn)}
.row2{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.row2 .sp{flex:1}
button,a.btn,select{font:inherit;min-height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:inherit;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}
button.pri,a.btn.pri{background:var(--p);border-color:var(--p);color:#fff}button.perigo{border-color:var(--er);color:var(--er)}button:disabled{opacity:.5;cursor:default}
button:focus-visible,a:focus-visible,select:focus-visible{outline:3px solid var(--f);outline-offset:2px}
.msg{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:13px;background:var(--c)}.msg.warn{background:var(--wnbg);color:var(--wn)}.msg.ok{background:var(--okbg);color:var(--ok)}.msg.err{background:var(--erbg);color:var(--er)}
ul{margin:4px 0 0;padding-left:18px}li{margin:2px 0}.ver{margin:10px 0 2px;font-weight:600}
label.fld{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}`;

  function h(tag, props = {}, ...kids) {
    const n = root.document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
    kids.flat().forEach(c => { if (c != null && c !== false) n.append(c.nodeType ? c : root.document.createTextNode(String(c))); });
    return n;
  }
  const version = () => { try { return root.chrome.runtime.getManifest().version; } catch (_) { return (ALN.novidades && ALN.novidades[0] && ALN.novidades[0].versao) || ''; } };
  function saveFile(name, text, mime) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    root.document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const stamp = now => new Date(now).toISOString().slice(0, 10);

  function open(view) {
    const old = root.document.getElementById(HOST_ID); if (old) old.remove();
    const host = h('div', { id: HOST_ID }); host.style.cssText = 'all:initial';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(h('style', {}, CSS));
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true' });
    const back = h('div', { class: 'back', onclick: e => { if (e.target === back) close(); } }, box);
    shadow.append(back);
    const close = () => host.remove();
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    root.document.documentElement.append(host);
    const fechar = h('button', { type: 'button', onclick: close }, 'Fechar');
    const draw = { compat: drawCompat, dados: drawDados, sobre: drawSobre }[view] || drawSobre;
    draw();
    const first = box.querySelector('button, a'); if (first) first.focus();

    function drawCompat() {
      box.setAttribute('aria-label', 'Compatibilidade desta página');
      const r = ALN.diagnostico.rodar(root.document, root.location, version());
      const text = ALN.diagnostico.comoTexto(r);
      const msg = h('div', { class: 'msg', role: 'status', 'aria-live': 'polite', hidden: true });
      box.replaceChildren(h('h2', {}, 'Compatibilidade desta página'),
        h('p', { class: 'sub' }, `${r.pagina} · ${r.host}. Mostra só o que a extensão reconheceu; sem nome, e-mail ou nota de aluno.`),
        ...r.itens.map(i => h('div', { class: 'it' }, h('b', {}, i.rotulo), h('span', { class: `pill ${i.estado}` }, i.detalhe))),
        msg,
        h('div', { class: 'row2' }, h('button', { type: 'button', class: 'pri', onclick: async () => {
          try { await root.navigator.clipboard.writeText(text); msg.textContent = 'Diagnóstico copiado. Cole na conversa para eu ajustar o que não bater.'; msg.className = 'msg ok'; } catch (_) { msg.textContent = 'Não consegui copiar. Selecione o texto abaixo e copie.'; msg.className = 'msg warn'; box.append(h('pre', { style: 'white-space:pre-wrap;font-size:12px' }, text)); }
          msg.hidden = false;
        } }, 'Copiar diagnóstico'), h('span', { class: 'sp' }), fechar));
    }

    function drawSobre() {
      box.setAttribute('aria-label', 'Sobre o Unidigit@l Assist');
      const nov = (ALN.novidades || []).slice(0, 3);
      box.replaceChildren(h('h2', {}, `Unidigit@l Assist ${version()}`),
        h('p', { class: 'sub' }, 'Por Eurico Cirilo · coautor Julio Alves · licença MIT'),
        h('div', { class: 'it' }, h('b', {}, 'Como atualizar'), h('small', {}, 'baixe o ZIP novo, extraia na mesma pasta e recarregue em chrome://extensions')),
        h('div', { class: 'row2' },
          h('a', { class: 'btn pri', href: `${REPO}/releases`, target: '_blank', rel: 'noopener noreferrer' }, 'Ver se há versão nova'),
          h('a', { class: 'btn', href: `${REPO}#readme`, target: '_blank', rel: 'noopener noreferrer' }, 'Ajuda')),
        h('p', { class: 'sub', style: 'margin-top:8px' }, '“Ver se há versão nova” só abre a página de versões no GitHub. A extensão não consulta a internet sozinha.'),
        ...nov.flatMap(n => [h('div', { class: 'ver' }, n.versao), h('ul', {}, n.itens.map(t => h('li', {}, t)))]),
        h('div', { class: 'row2' }, h('span', { class: 'sp' }), fechar));
    }

    async function drawDados(aviso) {
      box.setAttribute('aria-label', 'Meus dados');
      const S = ALN.storage;
      let state;
      try { state = await S.init(); } catch (e) { box.replaceChildren(h('h2', {}, 'Meus dados'), h('div', { class: 'msg err' }, 'Não consegui acessar o armazenamento do navegador.'), h('div', { class: 'row2' }, fechar)); return; }
      const all = state.all; const u = S.usage(all); const cfg = S.configOf(all);
      const msg = h('div', { class: 'msg', role: 'status', 'aria-live': 'polite', hidden: !aviso }, aviso ? aviso.texto : '');
      if (aviso) msg.className = `msg ${aviso.tipo || ''}`;
      const say = (texto, tipo) => { msg.textContent = texto; msg.className = `msg ${tipo || ''}`; msg.hidden = false; };
      const sel = h('select', { 'aria-label': 'Validade dos contatos', onchange: async e => { await S.saveConfig({ validadeContatosDias: Number(e.target.value) }); say('Validade salva. Registros mais antigos saem na próxima abertura.', 'ok'); } },
        S.VALIDADES.map(v => h('option', { value: String(v.dias), selected: v.dias === cfg.validadeContatosDias ? true : null }, v.rotulo)));
      const selL = h('select', { 'aria-label': 'Validade das leituras', onchange: async e => { await S.saveConfig({ validadeLeiturasDias: Number(e.target.value) }); say('Validade salva. Leituras mais antigas saem na próxima abertura.', 'ok'); } },
        S.VALIDADES_LEITURAS.map(v => h('option', { value: String(v.dias), selected: v.dias === cfg.validadeLeiturasDias ? true : null }, v.rotulo)));
      const pct = Math.max(u.total ? 1 : 0, Math.round(u.fracao * 100));
      const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0]; if (!f) return;
        const p = S.parseBackup(await f.text());
        if (!p.ok) { say(p.erro, 'err'); file.value = ''; return; }
        const n = p.resumo.categorias.map(c => `${c.categoria}: ${c.itens || 'dados'}`).join(', ') || 'sem registros';
        box.append(h('div', { class: 'msg warn', id: 'conf' }, `Backup de ${(p.criadoEm || '').slice(0, 10) || 'data desconhecida'} (${n}). Juntar com o que já existe ou substituir?`,
          h('div', { class: 'row2' },
            h('button', { type: 'button', class: 'pri', onclick: async () => { await S.writeImport(S.applyImport(await S.readAll(), p.dados, 'juntar')); drawDados({ texto: 'Backup juntado aos dados atuais.', tipo: 'ok' }); } }, 'Juntar'),
            h('button', { type: 'button', class: 'perigo', onclick: async () => { await S.writeImport(S.applyImport(await S.readAll(), p.dados, 'substituir')); drawDados({ texto: 'Dados substituídos pelo backup.', tipo: 'ok' }); } }, 'Substituir'),
            h('button', { type: 'button', onclick: () => { box.querySelector('#conf').remove(); file.value = ''; } }, 'Cancelar'))));
      });
      box.replaceChildren(h('h2', {}, 'Meus dados'),
        h('p', { class: 'sub' }, 'O que está guardado neste navegador e neste perfil. Nada vai para a nuvem.'),
        ...(u.categorias.length ? u.categorias.map(c => h('div', { class: 'it' }, h('b', {}, c.categoria), h('small', {}, c.itens ? `${c.itens} registro(s)` : c.rotulo), h('span', { class: 'pill' }, S.fmtBytes(c.bytes)))) : [h('div', { class: 'it' }, h('b', {}, 'Nada guardado ainda'), h('small', {}, 'os contatos aparecem aqui depois do primeiro envio'))]),
        h('div', { class: u.aviso ? 'bar hot' : 'bar', role: 'img', 'aria-label': `Uso ${pct}%` }, h('i', { style: `width:${Math.min(100, pct)}%` })),
        h('p', { class: 'sub' }, `Uso: ${S.fmtBytes(u.total)} de ${S.fmtBytes(u.quota)} (${pct}%). Aviso a partir de 70%.${u.aviso ? ' O limite está chegando: exporte um backup e apague o que não precisa.' : ''}`),
        h('label', { class: 'fld' }, 'Contatos expiram em ', sel), h('label', { class: 'fld' }, 'Leituras do comparativo expiram em ', selL),
        msg, file,
        h('div', { class: 'row2' },
          h('button', { type: 'button', class: 'pri', onclick: async () => { const n = Date.now(); saveFile(`unidigital-assist-backup-${stamp(n)}.json`, S.exportBackup(await S.readAll(), n, version()), 'application/json'); say('Backup baixado.', 'ok'); } }, 'Exportar backup'),
          h('button', { type: 'button', onclick: () => file.click() }, 'Importar'),
          h('button', { type: 'button', class: 'perigo', onclick: () => {
            if (box.querySelector('#apagar')) return;
            box.append(h('div', { class: 'msg err', id: 'apagar' }, 'Apagar todos os dados guardados por esta extensão neste navegador? Não dá para desfazer (exporte um backup antes).',
              h('div', { class: 'row2' }, h('button', { type: 'button', class: 'perigo', onclick: async () => { await S.clearAll(); drawDados({ texto: 'Tudo apagado.', tipo: 'ok' }); } }, 'Sim, apagar tudo'), h('button', { type: 'button', onclick: () => box.querySelector('#apagar').remove() }, 'Cancelar'))));
          } }, 'Apagar tudo…'),
          h('span', { class: 'sp' }), fechar));
    }
  }
  ALN.sistemaUi = { open, HOST_ID };
})(globalThis);
