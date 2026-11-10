// Criar conteúdo — parte de rede. Tudo na mesma origem, com a sessão do próprio usuário (como o navegador faria).
// Só envia depois da prévia e do clique em "Criar". O sesskey vai dentro do formulário do Moodle, em memória: nunca é lido à parte nem guardado.
(function (root) {
  'use strict';
  const CRI = root.CRI; const C = CRI.core;
  const PAUSA_MS = 1500;
  const sleep = (ms, signal) => new Promise((res, rej) => {
    if (signal && signal.aborted) return rej(new Error('Cancelado.'));
    const t = setTimeout(res, ms); if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Cancelado.')); }, { once: true });
  });
  const parse = html => new root.DOMParser().parseFromString(html, 'text/html');

  async function pegar(url, { signal, fetchImpl } = {}) {
    const f = fetchImpl || root.fetch.bind(root);
    const res = await f(url, { credentials: 'include', signal });
    if (res.redirected && /\/login\//.test(res.url)) throw new Error('A sessão do Moodle expirou. Entre de novo e tente outra vez.');
    if (!res.ok) throw new Error(`O Moodle respondeu ${res.status}.`);
    const doc = parse(await res.text());
    return { doc, url: res.url };
  }
  const urlForm = (origin, modname, cursoId, secao) => `${origin}/course/modedit.php?add=${encodeURIComponent(modname)}&course=${encodeURIComponent(cursoId)}&section=${encodeURIComponent(secao)}&return=0`;
  const urlCurso = (origin, cursoId) => `${origin}/course/view.php?id=${encodeURIComponent(cursoId)}`;

  // Só leitura. Diz se dá para criar neste curso e se já existe algo com o mesmo nome.
  async function checar({ origin, curso, modelo, nome, secao, opcoes = {} }) {
    const base = { curso, estado: 'pronta', detalhe: '', avisos: [] };
    try {
      const pag = await pegar(urlCurso(origin, curso.id), opcoes);
      const dup = C.acharPorNome(pag.doc, nome);
      if (dup.length) return { ...base, estado: 'existe', detalhe: 'Já existe uma atividade com este nome. Será pulada.' };
      await sleep(PAUSA_MS / 3, opcoes.signal);
      const f = await pegar(urlForm(origin, modelo.modname, curso.id, secao), opcoes);
      const form = C.achaForm(f.doc);
      if (!form) return { ...base, estado: 'sem_permissao', detalhe: 'Sem permissão de edição neste curso (o Moodle não abriu o formulário).' };
      const teste = C.montarEnvio(form, modelo, { nome, html: '<p>teste</p>', prazo: new Date(Date.now() + 864e5 * 10), abertura: new Date() });
      if (teste.erro) return { ...base, estado: 'incompativel', detalhe: teste.erro };
      return { ...base, avisos: teste.avisos };
    } catch (e) { return { ...base, estado: 'erro', detalhe: e && e.message ? e.message : String(e) }; }
  }

  // Cria UMA atividade, oculta, e lê de volta para confirmar. Devolve { estado: 'criada'|'incerta'|'falhou', detalhe, cmid }.
  async function criar({ origin, curso, modelo, nome, html, secao, abertura, prazo, opcoes = {} }) {
    try {
      const f = await pegar(urlForm(origin, modelo.modname, curso.id, secao), opcoes);
      const form = C.achaForm(f.doc);
      if (!form) return { estado: 'falhou', detalhe: 'Sem permissão de edição neste curso (o Moodle não abriu o formulário).' };
      const env = C.montarEnvio(form, modelo, { nome, html, abertura, prazo });
      if (env.erro) return { estado: 'falhou', detalhe: env.erro };
      const alvo = new URL(form.getAttribute('action') || f.url, f.url);
      if (alvo.origin !== origin || !/\/course\/modedit\.php$/.test(alvo.pathname)) return { estado: 'falhou', detalhe: 'O formulário aponta para outro endereço. Nada foi enviado.' };
      const fetchImpl = opcoes.fetchImpl || root.fetch.bind(root);
      const res = await fetchImpl(alvo.href, { method: 'POST', credentials: 'include', signal: opcoes.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: C.codificar(env.pares) });
      if (res.redirected && /\/login\//.test(res.url)) return { estado: 'falhou', detalhe: 'A sessão do Moodle expirou durante o envio.' };
      if (!res.ok) return { estado: 'falhou', detalhe: `O Moodle respondeu ${res.status}.` };
      const dep = parse(await res.text());
      // Se o Moodle devolveu o formulário (ou mensagens de erro), não criou. Quem confirma que criou é a leitura de volta abaixo.
      if (C.achaForm(dep) || C.errosDoForm(dep).length) { const er = C.errosDoForm(dep); return { estado: 'falhou', detalhe: er.length ? `O Moodle recusou: ${er.slice(0, 3).join(' | ')}` : 'O Moodle devolveu o formulário sem criar (confira os campos).' }; }
      // leitura de volta: achou na página do curso? está oculta?
      await sleep(PAUSA_MS / 3, opcoes.signal);
      const pag = await pegar(urlCurso(origin, curso.id), opcoes);
      const achadas = C.acharPorNome(pag.doc, nome);
      if (!achadas.length) return { estado: 'incerta', detalhe: 'O Moodle aceitou, mas não achei a atividade na página do curso. Confira no Moodle.' };
      const cmid = achadas[achadas.length - 1].cmid;
      const ed = await pegar(`${origin}/course/modedit.php?update=${encodeURIComponent(cmid)}`, opcoes);
      const vis = C.valorVisivel(ed.doc);
      if (vis !== '0') return { estado: 'incerta', cmid, detalhe: vis == null ? 'Criada, mas não consegui confirmar se está oculta. Confira no Moodle.' : 'Criada, mas ficou VISÍVEL para os alunos. Oculte no Moodle.' };
      return { estado: 'criada', cmid, detalhe: 'Criada oculta e conferida no Moodle.', avisos: env.avisos };
    } catch (e) { return { estado: 'falhou', detalhe: e && e.message ? e.message : String(e) }; }
  }

  CRI.api = { checar, criar, sleep, PAUSA_MS, urlForm, urlCurso };
})(globalThis);
