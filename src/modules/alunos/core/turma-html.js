// Painel HTML das turmas (arquivo único, abre offline, sem recurso externo): filtros, busca, detalhe por UC,
// notas por UC (parcial vale) e "Atenção" no fim. Função pura. Todo texto do Moodle passa por esc();
// o script embutido é fixo (não recebe dado concatenado) e só lê atributos data-* e usa textContent.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const sinal = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const num = n => String(n).replace('.', ',');

  const CSS = `:root{--p:#1a4b9f;--o:#ef5e31;--ink:#14202e;--mut:#55657a;--bd:#d6dee9;--bg:#f3f6fa;--bg2:#e8eef5;--s:#fff;--ok:#0f6b4f;--wn:#a14d08;--er:#b3261e;--soft:#e8f0fa;--okb:#dff3ea;--wnb:#fff0d6;--erb:#fde6e3}
@media (prefers-color-scheme:dark){:root{--p:#6b9be0;--ink:#e6ecf5;--mut:#9aa8bd;--bd:#2e3a4b;--bg:#121821;--bg2:#222d3b;--s:#1b2431;--ok:#6fd0a0;--wn:#f0b45a;--er:#ff8a80;--soft:#22344a;--okb:#143a2b;--wnb:#3a2c12;--erb:#3d1d1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:20px 16px 60px}
.hero{background:linear-gradient(135deg,#1a4b9f,#123a7d);color:#fff;border-radius:18px;padding:20px 24px;border-left:8px solid var(--o);display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.hero small{opacity:.85;letter-spacing:.08em;text-transform:uppercase;font-weight:700;font-size:12px}.hero h1{margin:4px 0 2px;font-size:24px}.hero p{margin:0;opacity:.9;font-size:13.5px}
.tools{display:flex;gap:8px;flex-wrap:wrap}.tools select,.tools input{min-height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.12);color:#fff;padding:0 10px;font:inherit}.tools option{color:#14202e}.tools input::placeholder{color:#dbe6f7}
nav{position:sticky;top:0;z-index:5;display:flex;gap:6px;flex-wrap:wrap;background:var(--bg);padding:10px 0;margin-top:6px}
nav a{padding:6px 12px;border-radius:99px;background:var(--s);border:1px solid var(--bd);color:var(--ink);text-decoration:none;font-size:13px;font-weight:600}nav a:hover,nav a:focus-visible{border-color:var(--p);color:var(--p);outline:none}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:8px 0 12px}
.kpi{all:unset;box-sizing:border-box;cursor:pointer;background:var(--s);border:1px solid var(--bd);border-left:5px solid var(--p);border-radius:14px;padding:12px 14px}.kpi:focus-visible,.lnk:focus-visible{outline:3px solid #f6b900;outline-offset:2px}
.kpi b{display:block;font-size:28px;line-height:1.1}.kpi span{color:var(--mut);font-size:13px}.kpi.o{border-left-color:var(--o)}.kpi.w{border-left-color:var(--wn)}.kpi.e{border-left-color:var(--er)}.kpi.on{background:var(--soft);border-color:var(--p)}
h2{font-size:18px;margin:26px 0 8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;scroll-margin-top:56px}h2 small{font-weight:400;color:var(--mut);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.card{background:var(--s);border:1px solid var(--bd);border-radius:14px;padding:14px 16px}.card[hidden],tr[hidden],.row[hidden],.empty[hidden]{display:none}
.card h3{margin:0;font-size:16px}.sub{color:var(--mut);font-size:13px;margin:0 0 8px}
.bar{display:flex;height:12px;border-radius:7px;overflow:hidden;background:var(--bg2);margin:8px 0 4px}.bar i{display:block;height:100%}.b1{background:var(--ok)}.b2{background:var(--o)}.b3{background:var(--wn)}
.leg{display:flex;gap:12px;flex-wrap:wrap;color:var(--mut);font-size:12px}.leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
.chip{display:inline-block;padding:1px 9px;border-radius:99px;font-size:12px;font-weight:700;margin:0 4px 4px 0}.c-d{background:var(--soft);color:var(--p)}.c-ok{background:var(--okb);color:var(--ok)}.c-wn{background:var(--wnb);color:var(--wn)}.c-er{background:var(--erb);color:var(--er)}
.lnk{font:inherit;min-height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:var(--p);cursor:pointer;font-weight:600}
details{margin-top:10px}summary{cursor:pointer;color:var(--p);font-weight:600;font-size:13.5px;min-height:28px}
table{width:100%;border-collapse:collapse}th,td{padding:7px 9px;text-align:left;border-bottom:1px solid var(--bd);font-size:13.5px}th{background:var(--bg2);color:var(--mut);font-size:11px;letter-spacing:.06em;text-transform:uppercase}td.n,th.n{text-align:right}
.tw{overflow-x:auto}.mini{display:inline-block;width:70px;height:8px;border-radius:5px;background:var(--bg2);vertical-align:middle;overflow:hidden;margin-right:6px}.mini i{display:block;height:100%;background:var(--p)}
.note{background:var(--wnb);color:var(--wn);border-radius:10px;padding:8px 12px;font-size:13px;margin:8px 0}.note ul{margin:4px 0 0;padding-left:18px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}.row select{min-height:36px;border:1px solid var(--bd);border-radius:8px;background:var(--s);color:var(--ink);padding:0 10px;font:inherit}.sp{flex:1}
.empty{padding:16px;text-align:center;color:var(--mut)}footer{margin-top:24px;color:var(--mut);font-size:12.5px}
@media (prefers-reduced-motion:no-preference){.card,.kpi{transition:border-color .2s}}
@media print{body{background:#fff}nav,.tools,.lnk{display:none}.card{break-inside:avoid}details{display:block}}`;

  // Script fixo: filtra, ordena e copia usando só data-* (que o servidor já escapou) e textContent.
  const SCRIPT = `(function(){var d=document,$=function(s){return d.querySelector(s)},A=function(s){return Array.prototype.slice.call(d.querySelectorAll(s))};
var fold=function(s){return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()};var st={t:'',q:'',k:''};
function ok(el){var t=el.getAttribute('data-turma');return(!st.t||t===st.t)&&(!st.q||fold(el.getAttribute('data-s')).indexOf(fold(st.q))>=0)}
function draw(){var n=0;A('.tc').forEach(function(c){var h=!ok(c)||(st.k&&Number(c.getAttribute('data-'+st.k))<=0);c.hidden=h;if(!h)n++});
$('#nT').textContent=n+' de '+A('.tc').length;var ne=$('#semT');if(ne)ne.hidden=n>0;
A('.nr').forEach(function(r){r.hidden=!ok(r)});
A('.kpi').forEach(function(b){b.classList.toggle('on',!!st.k&&b.getAttribute('data-k')===st.k);b.setAttribute('aria-pressed',String(!!st.k&&b.getAttribute('data-k')===st.k))});
var fm=$('#fm');fm.hidden=!st.k;atn()}
function atn(){var tb=$('#tAt tbody'),rows=A('.ar'),f=$('#aT').value,o=$('#aO').value;
rows.sort(function(a,b){return o==='nome'?a.getAttribute('data-n').localeCompare(b.getAttribute('data-n'),'pt-BR'):Number(b.getAttribute('data-d'))-Number(a.getAttribute('data-d'))});
var n=0;rows.forEach(function(r){tb.appendChild(r);var h=!ok(r)||(f&&r.getAttribute('data-turma')!==f);r.hidden=h;if(!h)n++});
$('#aC').textContent=n+' aluno(s)';var e=$('#aE');if(e)e.hidden=n>0;return rows.filter(function(r){return!r.hidden})}
$('#fT').addEventListener('change',function(e){st.t=e.target.value;draw()});
$('#fQ').addEventListener('input',function(e){st.q=e.target.value;draw()});
A('.kpi').forEach(function(b){b.addEventListener('click',function(){var k=b.getAttribute('data-k');if(!k)return;st.k=st.k===k?'':k;draw();if(k==='sem'&&st.k)$('#atencao').scrollIntoView()})});
$('#fc').addEventListener('click',function(){st.k='';draw()});
$('#aT').addEventListener('change',atn);$('#aO').addEventListener('change',atn);
$('#aCp').addEventListener('click',function(e){var b=e.target,t=atn().map(function(r){return r.getAttribute('data-n')}).join('\\n');
var done=function(m){b.textContent=m;setTimeout(function(){b.textContent='Copiar nomes'},1800)};
try{navigator.clipboard.writeText(t).then(function(){done('Copiado')},function(){done('Selecione e copie')})}catch(x){done('Selecione e copie')}});
draw()})();`;

  function turmaCard(t, diff) {
    const d = diff && diff.get(t.turma);
    const deltas = d ? (['matriculados', 'ativos', 'suspensos', 'semAcesso'].filter(k => d[k] !== 0).map(k => `<span class="chip c-d">${esc({ matriculados: 'Matriculados', ativos: 'Ativos', suspensos: 'Suspensos', semAcesso: 'Sem acesso' }[k])} ${sinal(d[k])}</span>`).join('') || '<span class="chip c-d">Sem mudança desde a leitura anterior</span>') : '<span class="chip c-d">Primeira leitura: sem comparação</span>';
    const com = Math.max(0, t.ativos - t.semAcesso);
    const ucs = t.ucs.map(u => `<tr><td>${esc(u.name)}</td><td class="n">${u.matriculados}</td><td class="n">${u.ativos}</td><td class="n">${u.suspensos}</td><td class="n">${u.semAcesso}</td></tr>`).join('');
    const busca = fold(`${t.turma} ${t.ucs.map(u => u.name).join(' ')} ${t.atencao.map(a => a.name).join(' ')}`);
    return `<section class="card tc" data-turma="${esc(t.turma)}" data-s="${esc(busca)}" data-ativos="${t.ativos}" data-susp="${t.suspensos}" data-sem="${t.semAcesso}"><h3>${esc(t.turma)}</h3><p class="sub">${t.matriculados} matriculados · ${t.ucs.length} UC(s)</p><div>${deltas}</div>
<div class="bar" role="img" aria-label="${com} com acesso recente, ${t.semAcesso} sem acesso, ${t.suspensos} suspensos"><i class="b1" style="width:${pct(com, t.matriculados)}%"></i><i class="b2" style="width:${pct(t.semAcesso, t.matriculados)}%"></i><i class="b3" style="width:${pct(t.suspensos, t.matriculados)}%"></i></div>
<div class="leg"><span><i class="b1"></i>Com acesso (${com})</span><span><i class="b2"></i>Sem acesso (${t.semAcesso})</span><span><i class="b3"></i>Suspensos (${t.suspensos})</span></div>
<details><summary>Ver UCs (${t.ucs.length})</summary><div class="tw"><table><thead><tr><th>UC</th><th class="n">Matric.</th><th class="n">Ativos</th><th class="n">Susp.</th><th class="n">Sem acesso</th></tr></thead><tbody>${ucs}</tbody></table></div></details></section>`;
  }

  function notaRow(n) {
    const s = fold(`${n.turma} ${n.uc}`);
    const estado = n.estado === 'completa' ? '<span class="chip c-ok">Completa</span>'
      : n.estado === 'parcial' ? `<span class="chip c-wn">Parcial · ${n.lidos}${n.de ? ` de ${n.de}` : ''} aluno(s)</span>`
        : '<span class="chip c-er">Não coletada</span>';
    const cols = n.estado === 'falhou'
      ? `<td colspan="4" style="color:var(--er)">${esc(n.motivo || 'Não foi possível ler o livro de notas.')}</td>`
      : `<td class="n">${n.media == null ? '—' : `<span class="mini"><i style="width:${Math.min(100, n.media * 10)}%"></i></span>${num(n.media)}`}</td><td class="n">${n.abaixo}</td><td class="n">${n.recuperacao}</td><td class="n">${n.semNota}</td>`;
    return `<tr class="nr" data-turma="${esc(n.turma)}" data-s="${esc(s)}"><td>${esc(n.uc)}</td><td>${esc(n.turma)}</td><td>${estado}</td>${cols}</tr>`;
  }

  // opts: { diff: Map, geradoEm, avisos: [string], notas: resumoNotas(...) | null, anteriorEm }
  function build(resumo, opts = {}) {
    const diff = opts.diff || new Map();
    const quando = new Date(opts.geradoEm || Date.now()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const comp = opts.anteriorEm ? ` · comparado com a leitura de ${esc(new Date(opts.anteriorEm).toLocaleDateString('pt-BR'))}` : '';
    const t = resumo.totais;
    const avisos = [...(opts.avisos || []), ...resumo.falhas.map(f => `${f.name}${f.category ? ` (${f.category})` : ''}: ${f.reason}`)];
    const notas = Array.isArray(opts.notas) ? opts.notas : null;
    const kp = (n, rot, cls, k) => `<button type="button" class="kpi ${cls}" data-k="${k}" aria-pressed="false"><b>${n}</b><span>${esc(rot)}${k ? ' · filtrar' : ''}</span></button>`;
    const atencao = resumo.turmas.flatMap(x => x.atencao.map(a => ({ ...a, turma: x.turma })));
    const opcoes = resumo.turmas.map(x => `<option value="${esc(x.turma)}">${esc(x.turma)}</option>`).join('');
    const atRows = atencao.map(a => `<tr class="ar" data-turma="${esc(a.turma)}" data-d="${a.dias}" data-n="${esc(a.name)}" data-s="${esc(fold(`${a.name} ${a.turma} ${a.ucs.join(' ')}`))}"><td>${esc(a.name)}</td><td>${esc(a.turma)}</td><td>${esc(a.ucs.join('; '))}</td><td class="n">${a.dias === 9999 ? 'nunca acessou' : a.dias}</td></tr>`).join('');
    const parc = notas ? notas.filter(n => n.estado === 'parcial').length : 0, falhas = notas ? notas.filter(n => n.estado === 'falhou').length : 0;
    const notasHtml = notas ? `<h2 id="notas">Notas por UC <small>mesmo quando a leitura vem parcial, o que foi lido aparece</small></h2><div class="card"><div class="tw"><table><thead><tr><th>UC</th><th>Turma</th><th>Leitura</th><th class="n">Média</th><th class="n">Abaixo da faixa</th><th class="n">Recuperação</th><th class="n">Sem nota</th></tr></thead><tbody>${notas.map(notaRow).join('') || '<tr><td colspan="7" class="empty">Nenhuma UC com notas lidas.</td></tr>'}</tbody></table></div>${parc || falhas ? `<div class="note">${parc ? `${parc} UC com leitura parcial: os números valem só para os alunos lidos. ` : ''}${falhas ? `${falhas} UC sem leitura: aparece com o motivo. ` : ''}No painel da extensão, “Tentar só as não verificadas” relê apenas essas.</div>` : ''}<p class="sub">Média na escala de 0 a 10, calculada sobre quem tem nota. “Abaixo da faixa”, “Recuperação” e “Sem nota” seguem as faixas dos Ajustes.</p></div>` : '';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Painel das turmas</title><style>${CSS}</style></head><body><div class="wrap">
<header class="hero"><div><small>Unidigit@l Assist</small><h1>Painel das turmas</h1><p>${resumo.turmas.length} turma(s) · lido em ${esc(quando)}${comp}</p></div>
<div class="tools"><select id="fT" aria-label="Filtrar por turma"><option value="">Todas as turmas</option>${opcoes}</select><input id="fQ" type="search" placeholder="Buscar turma, UC ou aluno" aria-label="Buscar turma, UC ou aluno"></div></header>
<nav aria-label="Seções"><a href="#resumo">Resumo</a><a href="#turmas">Turmas</a>${notas ? '<a href="#notas">Notas por UC</a>' : ''}<a href="#atencao">Atenção</a></nav>
<section id="resumo"><div class="kpis">${kp(t.matriculados, 'Matriculados', '', '')}${kp(t.ativos, 'Ativos', 'o', 'ativos')}${kp(t.suspensos, 'Suspensos/inativos', 'w', 'susp')}${kp(t.semAcesso, `Sem acesso ${resumo.limite}+ dias`, 'e', 'sem')}</div>
<div class="row" id="fm" hidden><span class="chip c-d">Filtro ativo nos cartões das turmas</span><button type="button" class="lnk" id="fc">Limpar filtro</button></div>
${avisos.length ? `<div class="note"><b>Atenção à leitura:</b><ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}</section>
<h2 id="turmas">Turmas <small id="nT"></small></h2><div class="grid">${resumo.turmas.map(x => turmaCard(x, diff)).join('')}</div><div class="empty" id="semT" hidden>Nenhuma turma encontrada com esse filtro.</div>
${notasHtml}
<h2 id="atencao">Atenção <small>alunos ativos sem acesso há ${resumo.limite}+ dias</small></h2>
<div class="card"><div class="row"><select id="aT" aria-label="Turma"><option value="">Todas as turmas</option>${opcoes}</select><select id="aO" aria-label="Ordenar"><option value="dias">Mais tempo sem acesso</option><option value="nome">Nome (A–Z)</option></select><span class="sp" id="aC" role="status" aria-live="polite"></span><button type="button" class="lnk" id="aCp">Copiar nomes</button></div>
<div class="tw"><table id="tAt"><thead><tr><th>Aluno</th><th>Turma</th><th>UC(s)</th><th class="n">Dias sem acesso</th></tr></thead><tbody>${atRows}</tbody></table></div><div class="empty" id="aE" hidden>Ninguém em atenção neste filtro.</div></div>
<footer>Feito com Unidigit@l Assist · By Eurico Cirilo e Julio Alves. Somente leitura; nada foi gravado no Moodle. Aluno em mais de uma UC da turma conta uma vez. “Sem acesso” = aluno ativo com último acesso há ${resumo.limite} dias ou mais (ou nunca). Os dados são do momento da leitura e ficam só neste arquivo; os nomes só aparecem aqui, em Atenção.</footer></div><script>${SCRIPT}</script></body></html>`;
  }

  ALN.turmaHtml = { build };
})(globalThis);
