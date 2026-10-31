// Relatório da UC em HTML único (abre offline, sem internet): todos os alunos, desempenho, entregas, pendências,
// último acesso e motivos de risco. Função pura: recebe um modelo e devolve o texto do arquivo.
// Todo texto vindo do Moodle passa por esc(); o script embutido é fixo (não recebe dados concatenados).
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const STATE = {
    avaliada: ['Entregue · avaliada', 'ok'], aguardando: ['Entregue · aguardando correção', 'wn'],
    sem_entrega: ['Sem entrega', 'er'], sem_nota: ['Sem nota', 'mu']
  };
  const LEVEL_CLASS = { imediato: 'er2', alto: 'er', atencao: 'wn', verificar: 'mu', regular: 'ok' };
  const fmtDate = t => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const CSS = `:root{--p:#0b5cad;--pd:#0a3f78;--ink:#14202e;--mut:#5b6b7c;--bd:#dbe3ec;--bg:#f3f6fa;--bg2:#e8eef5;--s:#fff;--ok:#13795b;--okbg:#e3f5ee;--wn:#9a5b00;--wnbg:#fff3dc;--er:#b42318;--erbg:#fde8e6;--inf:#e6f0fb;--r1:8px;--r2:14px}
@media (prefers-color-scheme:dark){:root{--ink:#e6edf5;--mut:#a9b6c5;--bd:#2f3d4f;--bg:#121a24;--bg2:#243246;--s:#1a2431;--ok:#5fd0a6;--okbg:#14382d;--wn:#f0b45a;--wnbg:#3a2c12;--er:#ff8a7e;--erbg:#43201c;--inf:#16314f;--p:#5aa6f0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:24px 16px 56px}
.hero{background:linear-gradient(135deg,#0b5cad,#0a3f78);color:#fff;border-radius:18px;padding:26px 28px;position:relative;overflow:hidden;animation:rise .6s both}.hero:after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.08)}
.hero small{opacity:.85;letter-spacing:.08em;text-transform:uppercase;font-weight:700;font-size:12px}.hero h1{margin:6px 0 4px;font-size:26px}.hero p{margin:0;opacity:.9}.tag{display:inline-block;margin:12px 6px 0 0;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 12px;font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}.kpi{background:var(--s);border:1px solid var(--bd);border-radius:var(--r2);padding:14px 16px;animation:rise .6s both}.kpi b{display:block;font-size:30px;line-height:1.1}.kpi span{color:var(--mut);font-size:13px}.kpi.ok b{color:var(--ok)}.kpi.wn b{color:var(--wn)}.kpi.er b{color:var(--er)}
.card{background:var(--s);border:1px solid var(--bd);border-radius:var(--r2);padding:18px;margin:12px 0;animation:rise .7s .2s both}.card h2{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut)}
.arow{display:grid;grid-template-columns:minmax(120px,220px) 1fr 120px;gap:10px;align-items:center;margin:8px 0;font-size:14px}.track{height:12px;background:var(--bg2);border-radius:999px;overflow:hidden}.track i{display:block;height:100%;border-radius:999px;background:var(--p);width:0;animation:grow 1s .5s forwards cubic-bezier(.2,.8,.2,1)}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:18px 0 10px}.tools input{flex:1;min-width:200px;height:40px;border:1px solid var(--bd);border-radius:var(--r1);padding:0 12px;font:inherit;background:var(--s);color:var(--ink)}
.chip,.pbtn{border:1px solid var(--bd);background:var(--s);color:var(--ink);border-radius:999px;padding:6px 14px;font:600 13px system-ui,sans-serif;cursor:pointer}.chip.on{background:var(--p);border-color:var(--p);color:#fff}.pbtn{color:var(--p);border-radius:var(--r1)}
.count{color:var(--mut);font-size:13px;margin:0 0 8px}
details.st{background:var(--s);border:1px solid var(--bd);border-radius:var(--r2);margin:8px 0;animation:rise .5s both}details.st[hidden]{display:none}
details.st>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:40px 1.4fr 1fr 1.1fr 1fr 18px;gap:12px;align-items:center;padding:12px 14px}details.st>summary::-webkit-details-marker{display:none}
.av{width:40px;height:40px;border-radius:50%;background:var(--inf);color:var(--p);display:grid;place-items:center;font-weight:800}.nm b{display:block}.nm small,.sub{color:var(--mut);font-size:12.5px}.old{color:var(--er)!important;font-weight:700}
.pill{display:inline-block;border-radius:999px;padding:2px 11px;font-size:12px;font-weight:700;white-space:nowrap}.pill.ok{background:var(--okbg);color:var(--ok)}.pill.wn{background:var(--wnbg);color:var(--wn)}.pill.er{background:var(--erbg);color:var(--er)}.pill.er2{background:var(--er);color:#fff}.pill.mu{background:var(--bg2);color:var(--mut)}
.bar2{display:block;height:8px;background:var(--bg2);border-radius:999px;position:relative;margin:6px 0 3px}.bar2 i{display:block;height:100%;border-radius:999px}.bar2 u{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--ink);opacity:.5}
.chev{color:var(--p);transition:transform .2s}details[open] .chev{transform:rotate(90deg)}
.body{padding:4px 18px 18px;border-top:1px solid var(--bd)}.k4{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0}.k4 div{background:var(--bg);border-radius:var(--r1);padding:10px}.k4 b{font-size:20px;display:block;line-height:1.1}.k4 span{font-size:12px;color:var(--mut)}
.sec{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);font-weight:700;margin:14px 0 6px}ul.why{margin:0;padding-left:18px}
table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--bd);font-size:13.5px}th{background:var(--bg2);color:var(--mut);font-size:11px;letter-spacing:.06em;text-transform:uppercase}.n{text-align:right;font-variant-numeric:tabular-nums}
.warn{background:var(--wnbg);color:var(--wn);border-radius:var(--r1);padding:8px 12px;font-size:13px;margin:8px 0}
footer{margin-top:24px;color:var(--mut);font-size:12.5px}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes grow{to{width:var(--w)}}
@media (max-width:760px){details.st>summary{grid-template-columns:40px 1fr 18px}details.st>summary>*:nth-child(n+3):not(.chev){grid-column:2}.arow{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;animation-delay:0s!important;transition:none!important}}
@media print{body{background:#fff}.tools,.pbtn{display:none}details.st{break-inside:avoid}details.st>*:not(summary){display:block}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

  // Script fixo: busca, filtros por chip e contagem animada. Não recebe dados do relatório.
  const SCRIPT = `(function(){var q=document.getElementById('q'),cs=[].slice.call(document.querySelectorAll('.chip')),st=[].slice.call(document.querySelectorAll('details.st')),ct=document.getElementById('ct'),f='todos';
function ap(){var t=(q.value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim(),n=0;st.forEach(function(d){var ok=(!t||d.getAttribute('data-n').indexOf(t)>-1)&&(f==='todos'||d.getAttribute('data-f').split(' ').indexOf(f)>-1);d.hidden=!ok;if(ok)n++});ct.textContent='Mostrando '+n+' de '+st.length+' aluno(s)'}
q.addEventListener('input',ap);cs.forEach(function(c){c.addEventListener('click',function(){f=c.getAttribute('data-f');cs.forEach(function(x){x.classList.toggle('on',x===c)});ap()})});
document.getElementById('pr').addEventListener('click',function(){window.print()});
var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
[].slice.call(document.querySelectorAll('[data-count]')).forEach(function(e){var t=parseFloat(e.getAttribute('data-count')),d=e.getAttribute('data-dec')==='1',k=0,fin=d?t.toFixed(1).replace('.',','):String(t);if(rm||isNaN(t)){e.textContent=fin;return}
(function s(){k+=Math.max(t/40,.1);if(k>=t){e.textContent=fin;return}e.textContent=d?k.toFixed(1).replace('.',','):String(Math.floor(k));requestAnimationFrame(s)})()});ap()})();`;

  function studentHtml(s, i, model) {
    const level = LEVEL_CLASS[s.level] || 'mu';
    const flags = [];
    if (['imediato', 'alto', 'atencao'].includes(s.level)) flags.push('atencao');
    if (s.pend > 0) flags.push('pend');
    if (s.accessDays != null && s.accessDays >= 15) flags.push('acc15');
    if (s.pend === 0) flags.push('em_dia');
    const tone = s.totalPct == null ? 'var(--bd)' : s.totalPct >= model.minimumGrade ? 'var(--ok)' : s.totalPct >= model.recoveryMin ? 'var(--wn)' : 'var(--er)';
    const initials = String(s.name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    const accessTxt = s.accessKnown ? (s.accessDays >= 9999 ? 'nunca acessou' : s.accessDays >= 1 ? `há ${s.accessDays} dia(s) sem acessar` : 'acessou hoje') : 'último acesso não lido';
    const rows = s.activities.map(a => {
      const [label, cls] = STATE[a.state] || STATE.sem_nota;
      return `<tr><td>${esc(a.name)}</td><td><span class="pill ${cls}">${esc(label)}</span></td><td class="n">${a.display ? esc(a.display) : '—'}</td><td>${esc(a.dueText || '—')}${a.overdue && a.state === 'sem_entrega' ? ' <span class="pill er">atrasada</span>' : ''}</td></tr>`;
    }).join('');
    const reasons = (s.reasons.length ? s.reasons : [s.unknown.length ? `Não deu para avaliar: falta ${s.unknown.join(' e ')}.` : 'Nada indica risco no que foi lido.']).map(r => `<li>${esc(r)}</li>`).join('');
    const contacts = s.contacts.length ? s.contacts.map(c => `<li>${esc(fmtDate(c.at))} · ${c.confirmed ? 'mensagem enviada e conferida' : 'mensagem enviada (conferir no Moodle)'}</li>`).join('') : '<li>Nenhuma mensagem enviada pela ferramenta.</li>';
    const pendTxt = model.entregasLidas ? `${s.pend} sem entrega` : `${s.pend} sem nota`;
    return `<details class="st" style="animation-delay:${Math.min(i, 30) * 0.03 + 0.3}s" data-n="${esc(norm(s.name + ' ' + s.email))}" data-f="${flags.join(' ')}"><summary>
<span class="av">${esc(initials)}</span><span class="nm"><b>${esc(s.name)}</b><small class="${s.accessDays != null && s.accessDays >= 15 ? 'old' : ''}">${esc(accessTxt)}</small></span>
<span><span class="pill ${level}">${esc(s.levelLabel)}</span><span class="sub" style="display:block;margin-top:4px">${esc(pendTxt)} · ${esc(s.entregues)}/${esc(s.itemCount)} entregues</span></span>
<span><b>${s.totalPct == null ? 'Sem nota' : 'Nota ' + esc(s.totalDisplay)}</b><span class="bar2"><i style="width:${Math.max(0, Math.min(100, s.totalPct || 0))}%;background:${tone}"></i><u style="left:${model.minimumGrade}%"></u></span><span class="sub">média mínima ${esc(model.minimumGrade)}</span></span>
<span class="sub">${esc(s.situationLabel)}</span><span class="chev" aria-hidden="true">›</span></summary>
<div class="body"><div class="k4"><div><b>${esc(s.totalDisplay || '—')}</b><span>nota total</span></div><div><b>${esc(s.entregues)}/${esc(s.itemCount)}</b><span>atividades entregues</span></div><div><b>${esc(s.pend)}</b><span>${model.entregasLidas ? 'sem entrega' : 'sem nota'}</span></div><div><b>${esc(s.accessKnown ? (s.accessDays >= 9999 ? 'Nunca' : s.accessDays + ' d') : '—')}</b><span>último acesso</span></div></div>
${s.email ? `<p class="sub">${esc(s.email)}</p>` : ''}<div class="sec">Por que está nesta situação</div><ul class="why">${reasons}</ul><p class="sub">Sugestão: ${esc(s.action)}</p>
<div class="sec">Atividades</div><table><thead><tr><th>Atividade</th><th>Situação</th><th class="n">Nota</th><th>Prazo</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sec">Contatos</div><ul class="why">${contacts}</ul></div></details>`;
  }

  function build(model) {
    const m = { minimumGrade: 60, recoveryMin: 40, ...model };
    const sm = m.summary;
    const warn = [...(m.warnings || [])];
    if (!m.entregasLidas) warn.push('As entregas das atividades não foram lidas: “sem nota” não prova que o aluno não entregou (pode estar aguardando correção).');
    if (m.entregasPendentes) warn.push(`${m.entregasPendentes} atividade(s) não tiveram as entregas lidas; as informações de entrega dessas ficam como “Sem nota”.`);
    const acts = (m.activities || []).map(a => `<div class="arow"><span title="${esc(a.name)}">${esc(a.name)}</span><div class="track"><i style="--w:${Math.max(0, Math.min(100, a.avgPct || 0))}%"></i></div><span class="sub">${a.avgPct == null ? 'sem notas' : 'média ' + esc(ALN.fmt(a.avgPct))} · ${esc(a.graded)}/${esc(a.total)} com nota</span></div>`).join('');
    const kpi = (n, label, cls, dec) => `<div class="kpi ${cls || ''}"><b data-count="${esc(n == null ? '' : n)}"${dec ? ' data-dec="1"' : ''}>${n == null ? '—' : esc(dec ? Number(n).toFixed(1).replace('.', ',') : n)}</b><span>${esc(label)}</span></div>`;
    const chips = [['todos', 'Todos'], ['atencao', 'Precisam de atenção'], ['pend', m.entregasLidas ? 'Com pendência' : 'Com item sem nota'], ['acc15', 'Sem acesso +15d'], ['em_dia', 'Em dia']].map(([id, l], i) => `<button type="button" class="chip${i === 0 ? ' on' : ''}" data-f="${id}">${l}</button>`).join('');
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.course.name)} — Relatório da UC</title><style>${CSS}</style></head><body><div class="wrap">
<header class="hero"><small>Relatório da UC · gerado em ${esc(fmtDate(m.readAt))}</small><h1>${esc(m.course.name)}</h1><p>${esc(m.categoryLabel || 'Todo o curso')}</p><span class="tag">${esc(sm.alunos)} alunos</span><span class="tag">${esc((m.activities || []).length)} atividades</span><span class="tag">${m.entregasLidas ? 'Entregas lidas' : 'Entregas não lidas'}</span></header>
<section class="kpis">${kpi(sm.alunos, 'alunos na turma')}${kpi(sm.media, 'média da turma (0–100)', 'ok', true)}${kpi(sm.atencao, 'em atenção', 'wn')}${kpi(sm.riscoAlto, 'risco alto ou imediato', 'er')}${kpi(sm.comPendencia, m.entregasLidas ? 'com atividade sem entrega' : 'com item sem nota')}${kpi(sm.sem30, 'sem acessar há +30 dias')}</section>
${warn.map(w => `<div class="warn">${esc(w)}</div>`).join('')}
<section class="card"><h2>Média por atividade</h2>${acts || '<p class="sub">Nenhuma atividade nesta seleção.</p>'}</section>
<div class="tools"><input id="q" type="search" placeholder="Buscar aluno ou e-mail" aria-label="Buscar aluno ou e-mail">${chips}<button type="button" class="pbtn" id="pr">Imprimir / salvar PDF</button></div>
<p class="count" id="ct"></p>
${m.students.map((s, i) => studentHtml(s, i, m)).join('\n')}
<footer>Gerado pela extensão Ferramentas EaD SENAI (somente leitura; nada foi gravado no Moodle). Os dados são do momento da leitura e ficam só neste arquivo. “—” significa sem nota, nunca zero. Por Eurico Cirilo.</footer></div><script>${SCRIPT}</script></body></html>`;
  }

  ALN.reportHtml = { build, esc };
})(globalThis);
