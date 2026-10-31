// Service worker: só define o nome/pasta dos ZIPs de pendências baixados pela extensão.
// O nome combinado fica em chrome.storage.session (o worker pode ser suspenso entre o aviso e o download).
'use strict';

const PREFIX = 'imn-pending-';
const TTL_MS = 3 * 60 * 1000;
const FILE_RE = /^imn-pending-([a-z0-9]{12,80})\.(zip|csv|txt)$/i;
const ALLOWED_EXT = /\.(zip|csv|txt)$/i;

function sanitizePath(value) {
  return String(value || '')
    .split('/')
    .map(segment => segment.replace(/[<>:"\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').replace(/^\.+/, '').replace(/[. ]+$/g, '').trim().slice(0, 100))
    .filter(Boolean)
    .join('/')
    .slice(0, 480);
}

async function purgeExpired() {
  const all = await chrome.storage.session.get(null);
  const stale = Object.entries(all).filter(([k, v]) => k.startsWith(PREFIX) && (!v || Date.now() - v.createdAt > TTL_MS)).map(([k]) => k);
  if (stale.length) await chrome.storage.session.remove(stale);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'imn-register-download') return false;
  (async () => {
    try {
      // Só aceita mensagens vindas de páginas da própria extensão (content scripts nos dois ambientes).
      const origin = sender.url ? new URL(sender.url).origin : '';
      if (sender.id !== chrome.runtime.id || !['https://ead.senai.br', 'https://ead.fieg.com.br'].includes(origin)) throw new Error('Origem não autorizada.');
      const token = String(message.token || '').toLowerCase();
      if (!/^[a-z0-9]{12,80}$/.test(token)) throw new Error('Identificador de download inválido.');
      const filename = sanitizePath(message.filename);
      if (!filename || !ALLOWED_EXT.test(filename)) throw new Error('Nome de arquivo inválido (use .zip, .csv ou .txt).');
      await purgeExpired();
      await chrome.storage.session.set({ [PREFIX + token]: { filename, createdAt: Date.now() } });
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
    }
  })();
  return true;
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const current = String(item.filename || '').split(/[\\/]/).pop() || '';
  const match = current.match(FILE_RE);
  if (!match) return false;
  const key = PREFIX + match[1].toLowerCase();
  chrome.storage.session.get(key).then(data => {
    const entry = data[key];
    if (entry && Date.now() - entry.createdAt <= TTL_MS) {
      chrome.storage.session.remove(key);
      suggest({ filename: entry.filename, conflictAction: 'uniquify' });
    } else {
      suggest();
    }
  }).catch(() => suggest());
  return true; // resposta assíncrona
});
