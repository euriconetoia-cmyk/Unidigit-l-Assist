// Guarda o cronograma importado e os ajustes por UC, só neste navegador (chrome.storage.local).
(function (root) {
  'use strict';
  const CRN = root.CRN; const KEY = 'crn.v1';
  const area = () => { try { return root.chrome && root.chrome.storage && root.chrome.storage.local; } catch (_) { return null; } };
  async function ler() { const a = area(); if (!a) return null; const r = await a.get(KEY); const v = r && r[KEY]; return v && v.v === 1 && v.dados ? v : null; }
  async function gravar(estado) { const a = area(); if (!a) throw new Error('Este navegador não permite guardar o cronograma.'); await a.set({ [KEY]: { ...estado, v: 1 } }); }
  async function apagar() { const a = area(); if (a) await a.remove(KEY); }
  CRN.store = { KEY, ler, gravar, apagar };
})(globalThis);
