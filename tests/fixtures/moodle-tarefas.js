// Páginas simuladas de tarefas (formato do Moodle 4): resumo, tabela de entregas e lista de atividades do curso.
import { ALUNOS } from './moodle-alunos.js';

export const TAREFAS = [
  { cmid: 701, nome: 'AV1 Fundamentos', prazo: '2026-10-05' },
  { cmid: 702, nome: 'AV2 Endereçamento', prazo: '2026-10-12' },
  { cmid: 703, nome: 'AV3 Serviços', prazo: '2026-10-19' },
  { cmid: 704, nome: 'AV4 Segurança', prazo: '2099-12-31' }
];
// Atividades extras que só o e2e usa (a página do curso 7 também lista as SAP do radar): sem nota no livro, todas avaliadas.
export const EXTRAS = [{ cmid: 101, nome: 'SAP 01', prazo: '2099-12-31' }, { cmid: 102, nome: 'SAP 02', prazo: '2099-12-31' }];
// status por tarefa e aluno: S = sem envio, E = enviada (aguardando correção), A = avaliada
const STATUS = {
  701: { 11: 'A', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A' },
  702: { 11: 'A', 12: 'A', 13: 'S', 14: 'A', 15: 'S', 16: 'A' },
  703: { 11: 'A', 12: 'E', 13: 'A', 14: 'S', 15: 'S', 16: 'A' },
  704: { 11: 'A', 12: 'A', 13: 'A', 14: 'S', 15: 'S', 16: 'A' },
  101: { 11: 'A', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A' },
  102: { 11: 'A', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A' }
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtenso = iso => { const [a, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${a}, 23:59`; };

export function courseWithAssignments() {
  return `<html><body><a href="/login/logout.php?sesskey=sk123456">Sair</a><div role="main"><h1>Segurança em Redes</h1><ul>${TAREFAS.map(t => `<li class="activity assign modtype_assign"><a href="/mod/assign/view.php?id=${t.cmid}"><span class="instancename">${t.nome}</span></a></li>`).join('')}</ul></div></body></html>`;
}

export function assignViewPage(cmid) {
  const t = TAREFAS.concat(EXTRAS).find(x => x.cmid === Number(cmid));
  const vals = Object.values(STATUS[cmid]);
  return `<html><body><div role="main"><h1>${t.nome}</h1><div class="activity-dates"><div><strong>Data de entrega:</strong> ${dataExtenso(t.prazo)}</div></div>
<div class="submissionsummary"><table class="generaltable"><tr><th>Participantes</th><td>${vals.length}</td></tr><tr><th>Enviados</th><td>${vals.filter(v => v !== 'S').length}</td></tr><tr><th>Precisa de avaliação</th><td>${vals.filter(v => v === 'E').length}</td></tr></table></div>
<a class="btn" href="/mod/assign/view.php?id=${cmid}&action=grading">Avaliação</a></div></body></html>`;
}

export function assignGradingPage(cmid, { alunos = ALUNOS } = {}) {
  const st = STATUS[cmid];
  const label = { S: 'Sem envio', E: 'Enviado para avaliação', A: 'Enviado para avaliação Avaliado' };
  const rows = alunos.map(a => `<tr><td><input type="checkbox" name="selectedusers" value="${a.id}"></td><td class="cell c2"><a href="/user/view.php?id=${a.id}&course=7">${a.nome}</a></td><td class="cell c3">${a.email}</td><td class="cell c4">${label[st[a.id]]}</td><td class="cell c5">${st[a.id] === 'A' ? '8,00 / 10,00' : '-'}</td><td class="cell c6">${st[a.id] === 'S' ? '-' : 'quinta-feira, 8 de outubro de 2026, 10:00'}</td></tr>`).join('');
  return `<html><body><div role="main"><table class="generaltable flexible"><thead><tr><th>Selecionar</th><th>Nome completo</th><th>Endereço de email</th><th>Status</th><th>Nota</th><th>Última modificação (envio)</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
}
