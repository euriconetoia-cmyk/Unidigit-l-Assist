// Página HTML do Relatório da turma (matriculados): um único arquivo, sem script e sem recurso externo (abre offline).
// Todo texto vindo do Moodle passa por esc(). Função pura: recebe o resumo de ALN.turma.resumoMatriculas.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinal = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const CSS = `:root{--p:#1a4b9f;--o:#ef5e31;--ink:#14202e;--mut:#55657a;--bd:#d6dee9;--bg:#f3f6fa;--bg2:#e8eef5;--s:#fff;--ok:#0f6b4f;--wn:#a14d08;--er:#b3261e;--soft:#e8f0fa}
@media (prefers-color-scheme:dark){:root{--p:#6b9be0;--ink:#e6ecf5;--mut:#9aa8bd;--bd:#2e3a4b;--bg:#121821;--bg2:#222d3b;--s:#1b2431;--ok:#6fd0a0;--wn:#f0b45a;--er:#ff8a80;--soft:#22344a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:24px 16px 56px}
.hero{background:linear-gradient(135deg,#1a4b9f,#123a7d);color:#fff;border-radius:18px;padding:24px 26px;border-left:8px solid var(--o);animation:rise .5s both}
.hero small{opacity:.85;letter-spacing:.08em;text-transform:uppercase;font-weight:700;font-size:12px}.hero h1{margin:6px 0 4px;font-size:25px}.hero p{margin:0;opacity:.9}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}.kpi{background:var(--s);border:1px solid var(--bd);border-left:5px solid var(--p);border-radius:14px;padding:12px 14px;animation:rise .6s both}
.kpi b{display:block;font-size:28px;line-height:1.1}.kpi span{color:var(--mut);font-size:13px}.kpi.o{border-left-color:var(--o)}.kpi.w{border-left-color:var(--wn)}.kpi.e{border-left-color:var(--er)}
.card{background:var(--s);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin:12px 0;animation:rise .6s both}
.card h2{margin:0 0 2px;font-size:17px}.sub{color:var(--mut);font-size:13px;margin:0 0 10px}
.delta{display:inline-block;margin:0 6px 6px 0;padding:1px 9px;border-radius:99px;background:var(--soft);color:var(--p);font-size:12px;font-weight:700}
.bar{display:flex;height:12px;border-radius:7px;overflow:hidden;background:var(--bg2);margin:8px 0 4px}.bar i{display:block;height:100%}.b1{background:var(--ok)}.b2{background:var(--o)}.b3{background:var(--wn)}
.leg{display:flex;gap:14px;flex-wrap:wrap;color:var(--mut);font-size:12px;margin-bottom:8px}.leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
table{width:100%;border-collapse:collapse}th,td{padding:7px 9px;text-align:left;border-bottom:1px solid var(--bd);font-size:13.5px}th{background:var(--bg2);color:var(--mut);font-size:11px;letter-spacing:.06em;text-transform:uppercase}td.n,th.n{text-align:right}
.tw{overflow-x:auto}details{margin-top:8px}summary{cursor:pointer;color:var(--p);font-weight:600;font-size:13.5px}ul{margin:6px 0 0;padding-left:20px;font-size:13.5px}
.warn{background:#fff3dc;color:#7a4300;border-radius:10px;padding:8px 12px;font-size:13px;margin:8px 0}@media (prefers-color-scheme:dark){.warn{background:#3a2c12;color:#f0c36a}}
footer{margin-top:22px;color:var(--mut);font-size:12.5px}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}@media print{body{background:#fff}.card,.kpi{break-inside:avoid;animation:none}}`;

  function turmaCard(t, diff) {
    const d = diff && diff.get(t.turma);
    const naoAtivos = t.suspensos, comAcesso = Math.max(0, t.ativos - t.semAcesso);
    const deltas = d ? ['matriculados', 'ativos', 'suspensos', 'semAcesso'].filter(k => d[k] !== 0).map(k => `<span class="delta">${esc({ matriculados: 'Matriculados', ativos: 'Ativos', suspensos: 'Suspensos', semAcesso: 'Sem acesso' }[k])} ${sinal(d[k])}</span>`).join('') || '<span class="delta">Sem mudança desde a leitura anterior</span>' : '';
    const ucs = t.ucs.map(u => `<tr><td>${esc(u.name)}</td><td class="n">${u.matriculados}</td><td class="n">${u.ativos}</td><td class="n">${u.suspensos}</td><td class="n">${u.semAcesso}</td></tr>`).join('');
    const atencao = t.atencao.length ? `<details><summary>Sem acesso há muito tempo (${t.atencao.length})</summary><ul>${t.atencao.map(a => `<li>${esc(a.name)} — ${a.dias === 9999 ? 'nunca acessou' : `${a.dias} dia(s) sem acesso`} <span style="color:var(--mut)">(${esc(a.ucs.join('; '))})</span></li>`).join('')}</ul></details>` : '';
    return `<section class="card"><h2>${esc(t.turma)}</h2><p class="sub">${t.matriculados} matriculados · ${t.ucs.length} UC(s) lida(s)</p>${deltas ? `<div>${deltas}</div>` : ''}
<div class="bar" role="img" aria-label="${comAcesso} ativos com acesso recente, ${t.semAcesso} ativos sem acesso, ${naoAtivos} suspensos"><i class="b1" style="width:${pct(comAcesso, t.matriculados)}%"></i><i class="b2" style="width:${pct(t.semAcesso, t.matriculados)}%"></i><i class="b3" style="width:${pct(naoAtivos, t.matriculados)}%"></i></div>
<div class="leg"><span><i class="b1"></i>Ativos com acesso recente (${comAcesso})</span><span><i class="b2"></i>Ativos sem acesso (${t.semAcesso})</span><span><i class="b3"></i>Suspensos/inativos (${naoAtivos})</span></div>
<div class="tw"><table><thead><tr><th>UC</th><th class="n">Matriculados</th><th class="n">Ativos</th><th class="n">Suspensos</th><th class="n">Sem acesso</th></tr></thead><tbody>${ucs}</tbody></table></div>${atencao}</section>`;
  }

  // opts: { diff: Map, geradoEm: Date|number, avisos: [string] }
  function build(resumo, opts = {}) {
    const diff = opts.diff || new Map();
    const quando = new Date(opts.geradoEm || Date.now()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const t = resumo.totais;
    const avisos = [...(opts.avisos || []), ...resumo.falhas.map(f => `${f.name}${f.category ? ` (${f.category})` : ''}: ${f.reason}`)];
    const kp = (n, rot, cls = '') => `<div class="kpi ${cls}"><b>${n}</b><span>${esc(rot)}</span></div>`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório da turma — matriculados</title><style>${CSS}</style></head><body><div class="wrap">
<header class="hero"><small>Unidigit@l Assist</small><h1>Turmas e matriculados</h1><p>${resumo.turmas.length} turma(s) · lido em ${esc(quando)}</p></header>
<div class="kpis">${kp(t.matriculados, 'Matriculados')}${kp(t.ativos, 'Ativos', 'o')}${kp(t.suspensos, 'Suspensos/inativos', 'w')}${kp(t.semAcesso, `Sem acesso há ${resumo.limite}+ dias`, 'e')}</div>
${avisos.length ? `<div class="warn"><b>Atenção:</b><ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
${resumo.turmas.map(x => turmaCard(x, diff)).join('')}
<footer>Aluno que está em mais de uma UC da turma conta uma vez. “Sem acesso” = aluno ativo com último acesso ao curso há ${resumo.limite} dias ou mais (ou nunca). Leitura somente leitura da lista de participantes de cada UC; nada foi gravado no Moodle.</footer></div></body></html>`;
  }

  ALN.turmaHtml = { build };
})(globalThis);
