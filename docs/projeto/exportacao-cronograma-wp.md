# Pedido ao Cronograma-WP: o que exportar para o Unidigit@l Assist

Decisão do usuário (01/11/2026): o Cronograma-WP **pode exportar o código do curso**; a UC é comparada **pelo nome**. A OS não interessa; vale o **código do Moodle / número do evento**, que abre o nome do curso (`1037240 - Técnico em Informática para Internet - 00001/2026`, `TEC.2026.2.184 - … - 00001/2026`).

## Acréscimos (compatíveis: formato continua `cronograma-ead-turma`, `versaoFormato` 1 → 1.1; campos novos são opcionais)
```json
"turma": {
  "moodle": {
    "codigo": "1037240",          // código do Moodle / nº do evento (texto)
    "numeroTurma": "00001/2026",  // nº/ano que fecha o nome do curso
    "nomeCurso": "1037240 - Técnico em Informática para Internet - 00001/2026"
  }
}
```
- `curso.nome` já existe e deve ser exatamente o nome do curso do Moodle (sem o código).
- Cada UC/recuperação já tem `nome`; a extensão compara por nome (sem acento/caixa). Opcional: `itens[].nomeNoMoodle` quando o título da seção for diferente.
- `suporte.idMoodle` (já existe, hoje `null`): preencher com o `id` do curso do Moodle quando conhecido.
- Se `turma.moodle` faltar, a extensão cai no nome do curso + nº/ano e pede confirmação.

## Como a extensão usa
1. Lê o nome do curso (`h1`) e separa em **código · curso · nº/ano**.
2. Código igual a `turma.moodle.codigo` → ligação "alta"; senão, curso + nº/ano → "média".
3. Dentro do curso, procura cada UC pelo nome (títulos das seções/tópicos da página). Quem não achar fica "sem par" e nunca é alterado.
4. `terminoAva` → fim do curso; datas das atividades vêm do cronograma; tudo só preenche, quem salva é a pessoa.
