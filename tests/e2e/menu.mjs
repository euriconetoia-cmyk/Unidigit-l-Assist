// Ajudante dos e2e: clica num item do menu novo, navegando sozinho pelo grupo ou pela engrenagem quando preciso.
const R = '#hub-ead-launcher';
export async function abrirItem(pg, id, opts) {
  const leaf = pg.locator(`${R} .app[data-app="${id}"]`);
  if (!(await leaf.isVisible())) {
    const view = await pg.evaluate(i => { const sr = document.querySelector('#hub-ead-launcher').shadowRoot; const b = sr.querySelector(`.app[data-app="${i}"]`); const v = b && b.closest('.view'); return v ? v.getAttribute('data-view') : null; }, id);
    if (view) {
      const main = pg.locator(`${R} [data-view="main"]`);
      if (view !== 'main' || !(await main.isVisible())) { if (!(await main.isVisible())) await pg.locator(`${R} .view:not([hidden]) [data-ctl="voltar"]`).click(); }
      if (view === 'apoio') await pg.click(`${R} [data-ctl="apoio"]`);
      else if (view.startsWith('grupo-')) await pg.click(`${R} .app[data-app="${view}"]`);
    }
  }
  await pg.click(`${R} .app[data-app="${id}"]`, opts);
}
