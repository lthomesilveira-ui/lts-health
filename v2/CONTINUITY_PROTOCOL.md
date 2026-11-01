# LTS Health — protocolo de continuidade

## Checkpoint mais recente — Relatórios mensais .111

A publicação vigente permanece `health-integrated-20261101.111`; o head reconciliado antes desta rodada é `43c83ba8db8fa66c4a9d396832fa68a141c59956` e o checkpoint privado é a versão 62. A jornada mensal distinta retomou o artefato exato `calendar-report-synthetic-evidence` 13070884236, SHA-256 `944e2eb05415ae386e642502bfd16feb10fbb673ef7f6decef4831a28e1be426`. Seus 32 cenários Chromium/WebKit passaram em 320/393/1440 px. Em 393 px, o mês anterior preservou período encerrado, cobertura por métrica, unidades, origens, gráficos, treino, exames, comparação e navegação; o PDF mensal manteve as mesmas ressalvas e separou origens sem somá-las. O estado vazio usou traços e declarou que lacunas não são zero. Nenhum defeito concreto foi observado, e o diff desde o último commit de runtime contém somente controles de continuidade.

Cloud Browser abriu a entrada pública `.111` em `#hoje`; após uma única recarga de recuperação, exibiu o login desconectado e a fronteira privada intacta. A inspeção sintética exata, a leitura pública desconectada e o gate autenticado já aprovado permanecem evidências distintas. Supabase foi somente lido: 66 recebimentos, sendo o mais recente aceito em 01/11/2026 10:09:21 UTC com 13 métricas e 1 candidato basal; 10 dias canônicos de água até 13/10, zero série explícita de gasto total, 118 candidatos basais sem fonte/limites/cobertura e 33 dias candidatos recentes de energia ativa até 31/10, ainda separados dos 98 dias canônicos até 05/05. Não houve nova resposta genuína de suporte, contato externo ou escrita. As quinze correções laboratoriais permanecem bloqueadas pelo manifesto original e autorização específica. Fila: 99 `done`, 14 `blocked_external`, 2 `accepted_gap` e zero executáveis; próxima inspeção: treinos.

Objetivo: qualquer nova sessão deve conseguir retomar o projeto com o estado real, sem depender da memória do chat e sem reabrir decisões já comprovadas.

## Frase curta de retomada

A frase canônica é **`LTSH-CONTINUE`**.

Se o usuário abrir um novo chat e enviar apenas `LTSH-CONTINUE` (ou incluir essa expressão numa mensagem), a sessão deve interpretar isso como: **retomar exatamente o LTS Health do último checkpoint real e continuar executando autonomamente**.

A frase não carrega estado por si só e não autoriza confiar na memória da conversa anterior. Ela obriga a executar o ritual abaixo: recuperar o repositório e as fontes duráveis, reconciliar trabalho paralelo, terminar `in_progress`, executar `ready` por prioridade e só pedir ação do usuário quando houver um bloqueio humano real. Se documentação e evidência divergirem, prevalece a evidência mais recente conforme as regras deste protocolo.

## Fontes de verdade, em ordem

1. Código, migrations, banco privado e evidência autenticada executada.
2. `EXECUTION_STATE.json`, que contém a fila operacional atual.
3. `PRODUCT_ARCHITECTURE.md` e `FEEDBACK_LEDGER.md`, que registram intenção, hierarquia, feedbacks e dívidas.
4. `PROJECT_BRIEF.md` e contratos específicos de produto/dados/visual.
5. `PROJECT_MASTER.md`, usado como histórico de marcos, não como fila.
6. Issues e pull requests do GitHub.
7. Arquivos de passagem e histórico de conversa, usados para recuperar contexto ainda não formalizado.

Se duas fontes divergirem, a evidência executada mais recente prevalece, exceto quando um feedback posterior do usuário reabre explicitamente a aceitação do produto. A divergência deve ser corrigida na documentação no mesmo pacote; não pode continuar como ambiguidade silenciosa.

## Ritual obrigatório ao retomar

1. Rebuscar imediatamente `main`, `architecture-v2`, `product-clarity-p0`, `v2/PROJECT_MASTER.md`, `v2/PROJECT_BRIEF.md`, `v2/PRODUCT_ARCHITECTURE.md`, `v2/FEEDBACK_LEDGER.md` e `v2/EXECUTION_STATE.json`.
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
- Um gate técnico anterior não prevalece sobre feedback posterior que rejeite a experiência publicada; nesse caso, a tarefa de produto precisa ser reaberta com novo critério de aceite.
- Item bloqueado não conta como executável.
- Trabalho contínuo de QA é regra de release, não pendência infinita.
- Uma limitação de dados aceita não vira tarefa interna até existir uma ação concreta e segura.
- O ledger não armazena valores pessoais, credenciais, payloads privados ou detalhes de tratamento.

## Reconciliação de rastreadores externos

- Todo issue aberto do GitHub precisa corresponder a uma tarefa do `EXECUTION_STATE.json` ou ser classificado imediatamente como duplicado/inválido.
- Quando todos os critérios de um issue estiverem comprovados, a tarefa fica `done`, preserva o URL em `external_references` e o issue é fechado com um resumo das evidências.
- Uma parte ainda dependente do usuário ou de terceiro vira tarefa bloqueada separada; ela não mantém artificialmente aberto o pacote que já foi entregue.
- Branches de referência sem commits exclusivos podem ser alinhados por fast-forward depois da promoção, sempre sem force.

## Health Auto Export aprovado — 04/10/2026

O usuário autorizou e comprou a ponte anual Health Auto Export. Executar a integração segura sem reabrir a autorização; a ativação em aparelho físico requer as permissões do Saúde e a configuração REST API pelo usuário. Isso não autoriza assinatura Apple Developer nem muda a regra do histórico original de água abaixo. A água desta ponte exige volume real e origem explícita.

## Hidratação pendente

`LTS-HYD-IMPORT-001` permanece aberto até existir uma linha canônica de água do MyFitnessPal com proveniência de exportação autenticada. No checkpoint de 26/10/2026 UTC, é `blocked_external`, sob responsabilidade do Codex: o bloqueio de segurança do provedor impede o acesso autenticado do navegador do agente. Isso não é uma etapa de configuração do iPhone ainda não feita. O helper de notebook continua disponível, mas não justifica pedir novamente os testes já concluídos, exportações manuais recorrentes ou registros duplicados. O ledger privado e a trigger de conclusão continuam vinculados à chegada de um lote autêntico. Preservar o bloqueio do provedor, sem contorná-lo.

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
