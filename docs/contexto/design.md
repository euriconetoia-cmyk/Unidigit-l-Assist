# Design — Blocos EaD SENAI

Mesmo visual das outras ferramentas: `--primary #0b5cad`, superfícies claras, tema claro/escuro pelo sistema, fonte do sistema 14px, botões 40px de altura mínima e raio 8px, foco visível (contorno 3px `#f6b900`), ícones de traço 20px. Botões principais de ação como ícone com `aria-label`/`title`.

- Painel lateral: barra no topo (Executar ▶, Parar ■, Exemplos, Salvar, Carregar), editor Blockly ocupando o espaço, registro de execução recolhível embaixo.
- Cores dos blocos por módulo: **Importar Notas** azul (`#0b5cad`), controle e lógica nas cores padrão do Blockly, **Registro** cinza.
- Vocabulário de estado do registro: azul = em andamento, verde = concluído, âmbar = aviso/aguardando o usuário, vermelho = erro.
