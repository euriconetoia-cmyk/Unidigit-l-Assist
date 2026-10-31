// Base mínima para os arquivos copiados do Assistente EaD (eles esperam o global MAT). Sem estado, sem rede.
(function (root) {
  'use strict';
  root.MAT = root.MAT || { metrics: { countFetch() {}, increment() {}, set() {} } };
  root.ALN = root.ALN || {};
})(globalThis);
