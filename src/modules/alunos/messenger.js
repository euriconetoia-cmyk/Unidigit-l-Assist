// Mensagem ao aluno pelo próprio Moodle (mensagens instantâneas), sempre por clique e com confirmação do tutor.
// Envia com a sessão do tutor (mesma origem), depois LÊ DE VOLTA a conversa para confirmar que a mensagem existe.
// Registro de contato: só no navegador (chrome.storage.local), nunca enviado a terceiros. Contato ≠ problema resolvido.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const STORE_KEY = 'hub.contatos.v1';
  const KEEP_PER_STUDENT = 5;
  const MAX_TEXT = 4000;
  const inFlight = new Set();
  const memory = {};

  const studentId = st => { const m = /^id:(\d+)$/.exec(st && st.key ? st.key : ''); return m ? Number(m[1]) : null; };

  // Só cita fatos lidos e que cabem ao aluno (a falta de nota lançada é do tutor, não do aluno).
  function buildMessage(st, courseName, settings, pend = []) {
    const s = { ...ALN.DEFAULTS, ...settings };
    const first = String(st.name || '').trim().split(/\s+/)[0] || 'aluno(a)';
    const codes = new Set(st.risk.reasons.map(r => r.code));
    const parts = [];
    if (st.lastAccessDays != null && (codes.has('no_access_attention') || codes.has('no_access_high') || codes.has('no_access_immediate'))) parts.push(`o seu último acesso ao ambiente foi há ${st.lastAccessDays} dias`);
    if (codes.has('grade_below_recovery') || codes.has('below_minimum')) parts.push(`a nota atual (${st.totalDisplay || ALN.fmt(st.totalPct)}) está abaixo da média mínima (${s.minimumGrade})`);
    else if (codes.has('recovery_range')) parts.push(`a nota atual (${st.totalDisplay || ALN.fmt(st.totalPct)}) está na faixa de recuperação`);
    const lista = (pend || []).filter(p => p && p.name);
    const resumo = parts.length ? `identifiquei que ${parts.join(' e ')}` : (lista.length ? 'identifiquei atividades pendentes' : 'gostaria de acompanhar a sua participação');
    const abertura = `Olá, ${first}, tudo bem? Ao acompanhar sua participação no curso${courseName ? ` ${courseName}` : ''}, ${resumo}.`;
    const fecho = 'Acesse o AVA para verificar e regularizar a situação. Caso tenha alguma dificuldade, responda esta mensagem para que possamos orientar você.';
    if (!lista.length) return `${abertura} ${fecho}`;
    // Só atividades que o Moodle disse que NÃO foram entregues (ou, sem leitura de entregas, sem nota — o tutor escolhe quais cobrar).
    return `${abertura}\n\nAtividades pendentes:\n${lista.map(p => `• ${p.name}${p.dueText ? ` (prazo ${p.dueText})` : ''}`).join('\n')}\n\n${fecho}`;
  }

  function sesskeyFromDoc(doc) {
    const link = doc.querySelector('a[href*="login/logout.php"][href*="sesskey="]');
    if (link) { const m = /sesskey=([A-Za-z0-9]+)/.exec(link.getAttribute('href')); if (m) return m[1]; }
    const input = doc.querySelector('input[name="sesskey"]');
    if (input && input.value) return input.value;
    for (const script of doc.querySelectorAll('script:not([src])')) { const m = /"sesskey"\s*:\s*"([A-Za-z0-9]+)"/.exec(script.textContent || ''); if (m) return m[1]; }
    return null;
  }

  async function call(origin, fetchImpl, sesskey, methodname, args) {
    const res = await fetchImpl(`${origin}/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=${methodname}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ index: 0, methodname, args }])
    });
    if (!res.ok) throw new Error(`O Moodle respondeu HTTP ${res.status}.`);
    let json;
    try { json = JSON.parse(await res.text()); } catch (_) { throw new Error('O Moodle devolveu uma resposta que não foi reconhecida.'); }
    const first = Array.isArray(json) ? json[0] : null;
    if (!first) throw new Error('O Moodle devolveu uma resposta vazia.');
    if (first.error) {
      const code = first.exception && first.exception.errorcode;
      if (code === 'invalidsesskey' || code === 'servicenotavailable' || code === 'requireloginerror') throw new Error('A sessão do Moodle expirou ou mudou. Recarregue a página e tente de novo.');
      throw new Error(`O Moodle recusou: ${(first.exception && first.exception.message) || 'erro sem detalhe'}.`);
    }
    return first.data;
  }

  // Envia e confere. Resultado: { confirmed, msgid, conversationid, at, note }.
  async function send({ userId, text, doc = root.document, fetchImpl = root.fetch.bind(root) }) {
    const body = String(text || '').trim();
    if (!userId) throw new Error('O identificador do aluno no Moodle não foi reconhecido. Abra o perfil dele e confira.');
    if (!body) throw new Error('Escreva a mensagem antes de enviar.');
    if (body.length > MAX_TEXT) throw new Error(`A mensagem passou de ${MAX_TEXT} caracteres.`);
    if (inFlight.has(userId)) throw new Error('Já existe um envio em andamento para este aluno.');
    inFlight.add(userId);
    try {
      const origin = root.location.origin;
      if (!root.MAT.utils.isAllowedMoodleUrl(origin)) throw new Error('Esta página não é do Moodle permitido.');
      const sesskey = sesskeyFromDoc(doc);
      if (!sesskey) throw new Error('Não consegui identificar a sua sessão do Moodle nesta página. Recarregue a página e tente de novo.');
      const data = await call(origin, fetchImpl, sesskey, 'core_message_send_instant_messages', { messages: [{ touserid: userId, text: body, textformat: 0 }] });
      const sent = Array.isArray(data) ? data[0] : null;
      if (!sent || !(Number(sent.msgid) > 0)) throw new Error(`O Moodle não enviou: ${(sent && sent.errormessage) || 'o aluno pode ter bloqueado mensagens ou o envio não é permitido para este curso'}.`);
      const out = { confirmed: false, msgid: Number(sent.msgid), conversationid: sent.conversationid || null, at: Date.now(), note: '' };
      // Leitura de volta: a mensagem precisa aparecer na conversa com o mesmo identificador.
      if (sent.conversationid && sent.useridfrom) {
        try {
          const conv = await call(origin, fetchImpl, sesskey, 'core_message_get_conversation_messages', { currentuserid: Number(sent.useridfrom), convid: Number(sent.conversationid), limitfrom: 0, limitnum: 10, newest: true });
          const msgs = (conv && conv.messages) || [];
          out.confirmed = msgs.some(m => Number(m.id) === out.msgid);
          if (!out.confirmed) out.note = 'O Moodle aceitou o envio, mas a mensagem não apareceu na conversa. Confira no Moodle.';
        } catch (e) { out.note = `Enviada, mas a conferência falhou (${e.message}). Confira no Moodle.`; }
      } else out.note = 'Enviada, mas este Moodle não informou a conversa para conferir. Confira no Moodle.';
      return out;
    } finally { inFlight.delete(userId); }
  }

  // ---- registro de contato (local) ----
  const hasStorage = () => Boolean(root.chrome && root.chrome.storage && root.chrome.storage.local);
  const courseKey = course => `${root.location.hostname}:${course.id}`;
  async function readAll() {
    try { if (hasStorage()) { const o = await root.chrome.storage.local.get(STORE_KEY); return o[STORE_KEY] || {}; } } catch (_) { /* usa memória */ }
    return memory;
  }
  async function writeAll(all) {
    try { if (hasStorage()) { await root.chrome.storage.local.set({ [STORE_KEY]: all }); return; } } catch (_) { /* usa memória */ }
    Object.assign(memory, all);
  }
  async function loadLog(course) { const all = await readAll(); return all[courseKey(course)] || {}; }
  async function addLog(course, studentKey, entry) {
    const all = await readAll(); const k = courseKey(course);
    all[k] = all[k] || {}; all[k][studentKey] = [...(all[k][studentKey] || []), entry].slice(-KEEP_PER_STUDENT);
    await writeAll(all); return all[k];
  }
  async function clearLog(course) {
    const all = await readAll(); delete all[courseKey(course)];
    try { if (hasStorage()) { await root.chrome.storage.local.set({ [STORE_KEY]: all }); } } catch (_) { /* ignora */ }
    delete memory[courseKey(course)];
  }

  ALN.messenger = { studentId, buildMessage, sesskeyFromDoc, send, loadLog, addLog, clearLog, MAX_TEXT };
})(globalThis);
