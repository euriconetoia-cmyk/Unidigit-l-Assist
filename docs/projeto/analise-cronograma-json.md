# Análise: automatizar o Moodle a partir do JSON do Cronograma EaD

Base: `cronograma_Teste_oyotrmh_v1_validado.json` (formato `cronograma-ead-turma` v1, sistema 2.24.0-rc1). Só leitura; nada aqui foi implementado.

## 1. O que o JSON já tem (e é confiável)
- **Turma/curso:** nome, unidade, início, término previsto, status "Validado" + versão + quem validou.
- **12 UCs + 14 recuperações + intro + 4 "Matrícula"**, em módulos (Básico, Específico I–IV), cada item com `inicio`, `termino`, `terminoAva` (fim do acesso ao AVA do bloco), carga (presencial/EaD) e `diasEstudoEad`.
- **Momentos por UC:** encontro presencial (data, horário), **webconferência** (data/hora) e **postagemNotas** (prazo de lançar notas).
- **Feriados/férias** (149 linhas; 147 datas únicas — há duplicatas) e a regra de dias síncronos (`diasPermitidos: [5]` = sábado).
- **`suporte.idMoodle`** em cada item — hoje `null` em todos: é o gancho previsto para ligar UC ↔ curso no Moodle.

## 2. O que NÃO tem e o Moodle precisa
| Falta | Efeito |
|---|---|
| Datas por **atividade** (SAP 01/02, Questionários, Web Aula) | O Moodle dá prazo a cada atividade; o JSON só dá a janela da UC. Precisa de uma **regra/modelo** (ex.: Questionário 1 = dia X..Y da UC). |
| **Código da UC** (ex.: `QUA-ASR-001`) | Os cursos do Moodle têm código no nome; o JSON só tem o nome da UC. Casar por nome funciona, mas é frágil (acentos, "Introdução à…" vs "Intro…"). |
| `idMoodle` preenchido | Sem ele, a ligação é por nome. |
| Horário limite (23:59) e fuso | Hoje fica na regra da extensão. |
| Equipe (tutor, monitor) | Todos `null` neste exemplo. |

## 3. Achados nos dados (a extensão pode validar antes de aplicar)
- Em **"Assessoria e Consultoria…"** o 1º presencial (13/05/2028) é **anterior ao início da UC** (15/05/2028).
- Feriados duplicados (07/07/2027 com 2 nomes; 12/10/2027 repetido).
- "Recuperação UC N" começa no **mesmo dia** da UC seguinte (intencional: rodam em paralelo).
- Todos os presenciais caem no sábado e nenhum em feriado; nenhuma `postagemNotas` antes do presencial. Ou seja, o arquivo é consistente fora o caso acima.
- Numeração de recuperações pula (UC 06 → 10 → 11 → 12 → 15 → 13 → 14): ok para casar por nome, ruim para casar por número.

## 4. O que dá para automatizar (por camada)
1. **Ligar JSON ↔ Moodle (leitura):** importar o JSON na extensão (seletor de arquivo, sem permissão nova), listar os cursos do Moodle do tutor ("Meus cursos") e sugerir o par UC ↔ curso; a pessoa confirma e a extensão guarda o par.
2. **Datas do curso (Configurações → Datas do curso):** início e fim sugeridos por `inicio` e `terminoAva`. Aplicar = abrir `/course/edit.php?id=…` preenchido; **quem salva é você**.
3. **Datas das atividades:** o "Conferir datas" atual vira o executor; a **fonte passa a ser o JSON + modelo da UC**, não só a tabela da página. Comparação em 3 pontas: JSON × tabela "Cronograma de Atividades" × atividade no Moodle.
4. **Tabela "Cronograma de Atividades":** gerar o HTML a partir do JSON (para colar no rótulo/sumário do curso). Evita digitar e evita divergência.
5. **Agenda do tutor:** encontros, webconferências e **prazos de postagem de notas** entram no "Resumo do dia" / retornos ("lançar notas até…"); alerta de recuperação aberta.
6. **Auditoria da turma:** relatório único "o que está diferente em todas as UCs", em CSV/Excel, sem alterar nada.
7. **Validação do próprio JSON** (achados da seção 3) antes de qualquer uso.

## 5. Regras de segurança (herdam do projeto)
- Nada é gravado no Moodle sem a pessoa clicar em **Salvar**; a extensão só pré-preenche e depois confere.
- Sem nova permissão: arquivo entra por `<input type=file>`; leitura/edição por GET same-origin.
- JSON guardado só no navegador (`chrome.storage.local`), versionado; entra em "Meus dados"/apagar. Atenção à LGPD quando vierem equipe e alunos.
- Só versão **Validada** vira fonte por padrão; rascunho exige confirmação. Guardar a versão do JSON usada em cada conferência.
- Divergência entre JSON e Moodle **nunca é corrigida sozinha**: o JSON rege, mas a pessoa decide.

## 6. Roteiro sugerido
| Fase | Entrega | Risco |
|---|---|---|
| A | Importar JSON + validar + painel "Cronograma da turma" (só leitura) | baixo |
| B | Ligar UC ↔ curso do Moodle (sugestão por nome, confirmação, guarda `idMoodle` local) | baixo |
| C | Relatório de divergências da turma (JSON × página × atividades) em Excel | médio (muitas leituras → pausa/cancelar) |
| D | Modelos de atividades por UC + aplicar datas (reaproveita Conferir datas) | médio |
| E | Datas do curso (`course/edit.php`) e gerar a tabela HTML | médio |
| F | Agenda (webconf., presencial, notas) no Resumo do dia | baixo |

## 7. Respostas do usuário (01/11/2026) e o que ainda falta
- Nome do curso no Moodle: `1037240 - Técnico em Informática para Internet - 00001/2026` e `TEC.2026.2.184 - Técnico em Redes de Computadores - 00001/2026` (código/OS · curso · nº/ano). O código casa com `turma.os`.
- Datas das atividades: conforme o cronograma. `terminoAva` = fim do curso no Moodle: **sim**.
- Em aberto: exportar código da UC e `idMoodle`; se o curso do Moodle é por turma (com as UCs dentro) ou por UC; vários JSONs.

### Perguntas originais
1. Há **um curso Moodle por UC por turma**? Como é o nome (código + turma)?
2. Como as datas das atividades derivam da UC (ex.: Questionário 1 abre no início e fecha em N dias; SAP no fim)? Posso levantar isso das tabelas reais que você já me mostrou.
3. `terminoAva` deve virar o **fim do curso** no Moodle?
4. O sistema Cronograma-WP pode passar a exportar **código da UC, `idMoodle` e modelo de atividades**? (Elimina o casamento por nome.)
5. Teremos vários JSONs ao mesmo tempo (um por turma)? Em que ordem priorizar?

## 8. Próximo passo proposto
Mockup da **Fase A + B** (importar JSON → painel da turma → ligar cada UC ao curso do Moodle), para validar antes de codar.

## 9. Textos do curso (rótulos) — pedido de 01/11/2026
Além das datas das atividades, as datas escritas nos **rótulos** do curso também devem ser atualizadas: o **cabeçalho** ("Período de Realização") e o **"Cronograma completo da UC"** (Período, tabela de atividades, "Datas das Webaulas", "Encontros Presenciais"). Teste com os dois HTMLs reais: dá para trocar **só as datas** e o restante do HTML (cores, textos, pontos) fica idêntico.
- **Vêm direto do JSON:** Período (UC `inicio`–`termino`), data das Webaulas (`webconferencia.data`), data dos Encontros (`momentos[].data`), linha "Momento Presencial" (1º e último encontro).
- **Dependem de regra:** linhas Fórum/SAP/Avaliação Final (início/término). No exemplo, 16/10→29/10 com o 1º encontro em 31/10 sugere "término = 2 dias antes do 1º encontro" — confirmar com o usuário.
- **Não mudam:** hora das webaulas (JSON só tem o início), "Horário Limite", "Valor", orientações.
- **Limite técnico:** o editor do Moodle refaz o texto ao salvar; por isso a aplicação é "copiar HTML atualizado → colar em Código-fonte → Salvar", com conferência depois (ou apenas mostrar antes/depois).
