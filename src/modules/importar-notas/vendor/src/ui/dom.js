// Construtor de DOM seguro: todo texto entra via nó de texto (nunca innerHTML).
(function (root) {
  'use strict';

  function h(doc, tag, props, ...children) {
    const el = doc.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child.nodeType ? child : doc.createTextNode(String(child)));
    }
    return el;
  }

  // Ícone de traço (24x24) montado por nós SVG, sem innerHTML.
  function icon(doc, pathData) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = doc.createElementNS(NS, 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
    return svg;
  }

  root.IMN.dom = { h, icon };
})(globalThis);
