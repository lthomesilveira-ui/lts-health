# LTS Health — protocolo de continuidade

Objetivo: qualquer nova sessão deve conseguir retomar o projeto com o estado real, sem depender da memória do chat e sem reabrir decisões já comprovadas.

## Fontes de verdade, em ordem

1. Código, migrations, banco privado e evidência autenticada executada.
2. `EXECUTION_STATE.json`, que contém a fila operacional atual.
3. `PROJECT_BRIEF.md` e contratos específicos de produto/dados/visual.
4. `PROJECT_MASTER.md`, usado como histórico de marcos, não como fila.
5. Issues e pull requests do GitHub.
6. Arquivos de passagem e histórico de conversa, usados para recuperar contexto ainda não formalizado.

Se duas fontes divergirem, a evidência executada mais recente prevalece. A divergência deve ser corrigida na documentação no mesmo pacote; não pode continuar como ambiguidade silenciosa.

## Ritual obrigatório ao retomar

1. Rebuscar imediatamente `main`, `architecture-v2`, `product-clarity-p0`, `v2/PROJECT_MASTER.md`, `v2/PROJECT_BRIEF.md` e `v2/EXECUTION_STATE.json`.
2. Conferir pull requests, workflows e issues posteriores à última evidência registrada.
3. Auditar somente metadados agregados/operacionais no banco; dados pessoais não entram no repositório público.
4. Recalcular a fila:
   - `in_progress`: terminar ou reverter com segurança;
   - `ready`: executar autonomamente por prioridade;
   - `blocked_user`: manter visível e dizer exatamente qual ação humana falta;
   - `blocked_external`: registrar dependência e a evidência que a desbloqueia;
   - `accepted_gap`: preservar sem inventar trabalho ou dados.
5. Escolher um pacote coerente, implementar, testar e atualizar o ledger antes da promoção.
6. Repetir até não restar item `ready` ou `in_progress`.

## Regra de escrita no GitHub

Antes de cada escrita, reler os heads de `main`, `architecture-v2` e `product-clarity-p0`, além de `v2/PROJECT_MASTER.md` em `architecture-v2`. A atualização deve ser fast-forward e nunca usar force. Trabalho paralelo é preservado e reconciliado por merge normal.

## Regra de estado

- Todo item tem ID estável, prioridade, responsável, critério de aceite, evidência, próximo passo e bloqueio quando houver.
- `done` exige evidência executada; intenção, código não publicado ou CI pendente não bastam.
- Item bloqueado não conta como executável.
- Trabalho contínuo de QA é regra de release, não pendência infinita.
- Uma limitação de dados aceita não vira tarefa interna até existir uma ação concreta e segura.
- O ledger não armazena valores pessoais, credenciais, payloads privados ou detalhes de tratamento.

## Reconciliação de rastreadores externos

- Todo issue aberto do GitHub precisa corresponder a uma tarefa do `EXECUTION_STATE.json` ou ser classificado imediatamente como duplicado/inválido.
- Quando todos os critérios de um issue estiverem comprovados, a tarefa fica `done`, preserva o URL em `external_references` e o issue é fechado com um resumo das evidências.
- Uma parte ainda dependente do usuário ou de terceiro vira tarefa bloqueada separada; ela não mantém artificialmente aberto o pacote que já foi entregue.
- Branches de referência sem commits exclusivos podem ser alinhados por fast-forward depois da promoção, sempre sem force.

## Hidratação pendente

`LTS-HYD-IMPORT-001` permanece `blocked_user` enquanto o banco não contiver uma linha canônica de água do MyFitnessPal com proveniência de exportação autenticada. O app exibe um caminho explícito para continuar no notebook, sem sugerir digitação diária ou instalação de aplicativo; o ledger privado registra a solicitação; e uma trigger muda a solicitação para concluída quando o primeiro lote válido chegar.

Sem data e horário escolhidos, não existe notificação agendada. A pendência deve ser citada em cada checkpoint do projeto até ser concluída. Se o usuário definir quando deseja ser lembrado, criar uma automação separada e registrar sua existência no ledger.

## Validação mínima por pacote

- Sintaxe de todo arquivo alterado.
- Contratos diretamente afetados.
- Browser gate em desktop e mobile para mudança de interface.
- Advisor e consulta pós-migration para mudança de banco.
- Workflow do head candidato.
- Deploy público e smoke real quando a mudança atingir a aplicação publicada.
- Atualização de `EXECUTION_STATE.json` e execução de `continuity-contract-smoke.mjs`.

## Encerramento de uma sessão

O relatório final usa exatamente:

- `Concluído`
- `Em execução`
- `Próximos passos`

Ele informa o que foi comprovado, o que continua bloqueado e qual sinal encerra cada bloqueio. Nada importante pode existir apenas nesse relatório: o estado durável deve estar no repositório ou no ledger privado apropriado.
