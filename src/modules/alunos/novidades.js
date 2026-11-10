// Novidades mostradas na tela "Sobre". Mantenha a primeira entrada igual à versão do manifest (o validador confere).
(function (root) {
  'use strict';
  root.ALN.novidades = [
    { versao: '0.18.0', itens: ['Menu enxuto: só o que serve para a página, sem descrições, com o apoio atrás da engrenagem', 'Criar conteúdo (teste): fórum de apresentação, atividade de envio e texto de boas-vindas, com prévia, tudo criado oculto e conferido', 'Seção escolhida pelo nome em cada curso, com trava se a seção mudar', 'Importar modelo em DOCX, HTML ou texto, com {{campos}}', 'Relatório da turma com matriculados e painel dinâmico (HTML), com Notas por UC e Atenção no fim'] },
    { versao: '0.17.0', itens: ['Menu em aba na borda direita (não cobre mais o VLibras), com atalho Alt+U e setas', 'Ícone próprio por ferramenta, cor única (azul SENAI) e aviso “não se aplica aqui”', 'Mover aba: ajusta a altura e lembra', 'Meus dados inclui o cronograma importado e a altura da aba'] },
    { versao: '0.16.0', itens: ['Resumo do dia: primeira tela do Alunos e notas (risco, sem acesso, a corrigir, retornos, piorou)', 'Ajustes por UC (nota mínima, recuperação, dias sem acesso, pausa, validade das leituras) com padrão para todas', 'Régua de nota na Correção, com prévia Antes/Depois', 'Relatório da turma: campo de busca para achar só os cursos que você quer', 'Relatório da turma: com leitura incompleta não baixa sozinho; botão “Tentar só as não verificadas”'] },
    { versao: '0.15.0', itens: ['Modelos de mensagem com campos ({nome}, {uc}, {nota}…), na mensagem individual e na fila', 'Retornos agendados: “Ver de novo em…” e o painel Retornos de hoje', 'Comparativo desde a leitura anterior (só números guardados)'] },
    { versao: '0.14.0', itens: ['Menu com a gaveta “Ferramentas” (Kahoot, modelo de perguntas, Compatibilidade, Meus dados e Sobre)', 'Kahoot: importar perguntas de um CSV no editor, com conferência, progresso e cancelar', 'Permissão do Kahoot opcional, só quando você pede'] },
    { versao: '0.13.0', itens: ['Verificar compatibilidade desta página (sem dados de aluno)', 'Tela Sobre', 'Meus dados: uso, backup, importar, validade e apagar', 'Armazenamento com versão de formato e ID fixo da extensão'] },
    { versao: '0.12.0', itens: ['Relatório da turma em “Meus cursos”, com Excel por turma'] },
    { versao: '0.11.0', itens: ['Excel (.xlsx) em Alunos, Notas, Acompanhamento e Relatório da UC'] },
    { versao: '0.10.0', itens: ['Fila de envio de mensagens com revisão e “Tentar de novo”'] }
  ];
})(globalThis);
