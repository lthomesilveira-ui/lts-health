# LTS Health — registro consolidado de feedback

Status: fonte de verdade dos feedbacks de produto recuperados. O texto é público e não inclui dados pessoais de saúde.

## Como usar

- Cada feedback recebe um ID estável.
- `Entregue` exige evidência verificável no produto ou na documentação.
- `Em execução` precisa corresponder ao pacote atual de `EXECUTION_STATE.json`.
- `Bloqueado` precisa indicar a evidência externa que falta.
- Um feedback não some quando é entregue; seu histórico e a evidência permanecem aqui.

## Feedbacks e decisões

| ID | Origem | Feedback consolidado | Tradução para produto | Estado | Evidência ou próximo passo |
| --- | --- | --- | --- | --- | --- |
| FB-001 | 26/08 | O produto deve ser um assistente de saúde completo, longitudinal e capaz de identificar lacunas. | A abertura produz leitura, mudança, cobertura e prioridades; não apenas números. | Em execução | `PRODUCT_ARCHITECTURE.md`; pacote P0 de Home. |
| FB-002 | 26/08 | Centralizar Apple Saúde, Polar, MyFitnessPal, bioimpedância, exames, documentos, treinos e contexto de tratamentos. | Fontes distintas entram em domínios ligados por Timeline e visão longitudinal. | Entregue parcialmente | `PROJECT_BRIEF.md`; telas e camada de dados existentes; integrações externas permanecem no ledger. |
| FB-003 | 28/08 | A aplicação anterior é o piso, não o resultado final. | Preservar capacidades e proveniência enquanto a experiência evolui além da implementação original. | Em execução | `PARITY_MATRIX.md`; reorganização P0/P1. |
| FB-004 | 04/09 | A imagem aprovada é a referência visual canônica. | Layout claro com rail escuro, hierarquia executiva e cinco domínios. | Bloqueado parcialmente | Contrato textual preservado; imagem-fonte original precisa ser recuperada para paridade pixel. |
| FB-005 | 04–05/09 | Não reiniciar nem perder o estado real já construído. | Evoluir por migração compatível, sem sobrescrever histórico, dados ou branches. | Entregue | `CONTINUITY_PROTOCOL.md`; políticas de merge e proveniência. |
| FB-006 | 28/08 | Área azul e textos sem sentido não podem permanecer. | Cor precisa ter função; copy deve explicar a decisão ou o estado. | Em execução | Novo pacote visual e revisão de linguagem. |
| FB-007 | 28/08 | O app abriu sem carregar conteúdo. | Loading, falha parcial e sessão precisam ser distinguíveis e testados. | Entregue tecnicamente | Estados explícitos e browser gates; será revalidado no pacote visual. |
| FB-008 | 29/08 | Fotos/rotas prometidas não carregavam e correções não apareciam. | Não declarar correção sem validar a superfície pública real. | Regra permanente | Gate de deploy público em `PRODUCT_ARCHITECTURE.md` e `CONTINUITY_PROTOCOL.md`. |
| FB-009 | Histórico | Nenhum dado ou implementação útil pode ser perdido. | Preservação da fonte, backup verificável, migrações e merge sem force. | Entregue | `DATA_AUDIT.md`; `BACKUP_TRACEABILITY_CONTRACT.md`; políticas do ledger. |
| FB-010 | Histórico | O usuário não deve servir como QA de microentregas. | Pacotes coerentes passam QA desktop/mobile antes da apresentação. | Regra permanente | `PRODUCT_ARCHITECTURE.md`; release gates. |
| FB-011 | 08/09 | Histórico de água não pode exigir digitação diária; conexão direta ao MyFitnessPal é preferível. | Transferência histórica em lote agora; OAuth oficial quando houver acesso do provedor. | Entregue parcialmente | Fluxo autenticado em lote; `LTS-HYD-IMPORT-001` e `LTS-MFP-OAUTH-001`. |
| FB-012 | 08/09 | Briefing, pendências e implementação não podem depender da memória do chat. | Arquitetura, feedbacks e fila operacional ficam versionados. | Entregue neste pacote | `PRODUCT_ARCHITECTURE.md`; este ledger; `EXECUTION_STATE.json`. |
| FB-013 | 08/09 | O link publicado ainda está longe do ideal. | Reabrir conclusão visual; testes antigos deixam de equivaler a homologação de produto. | Em execução | Pacote P0 de shell, Home e navegação. |
| FB-014 | 08/09 | A interface parece um apanhado de coisas já rejeitadas. | Organizar a experiência por perguntas e jornadas, remover redundâncias e peso visual uniforme. | Em execução | Arquitetura de informação e implementação P0. |

## Dívidas identificadas pela auditoria

| ID | Problema | Impacto | Tratamento |
| --- | --- | --- | --- |
| D-001 | Quatro camadas de CSS e dois scripts pós-processavam a Home para perseguir a referência. | Layout frágil, tipografia comprimida e difícil manutenção. | Substituir por uma renderização e uma folha canônicas. |
| D-002 | Testes verificavam presença de seções, não prioridade, legibilidade ou trabalho do usuário. | Um dashboard tecnicamente completo podia continuar errado como produto. | Adicionar contrato de arquitetura e gates de hierarquia/legibilidade. |
| D-003 | `Evolução`, `Histórico`, `Insights` e áreas de domínio competiam sem agrupamento. | Carga cognitiva e navegação sem modelo mental claro. | Agrupar navegação e retirar `Evolução` do primeiro nível. |
| D-004 | “Ver mais” repetido e resumo duplicado em vários blocos. | Ações sem propósito e sensação de coleção de cards. | Usar ações específicas e separar leitura, prioridades e evidência. |
| D-005 | A tela de login podia expor partes do shell em alguns estados. | Entrada com aparência inacabada. | Isolar o app autenticado e testar ausência de vazamento visual. |
| D-006 | A imagem visual aprovada não foi versionada como artefato. | Impossível provar fidelidade exata. | Recuperar e versionar a fonte antes de nova alegação de paridade pixel. |

## Regra de reconciliação

Ao fim de cada pacote, os IDs afetados são atualizados aqui e vinculados a tarefas/evidências de `EXECUTION_STATE.json`. Nenhuma alegação antiga de “10/10” substitui feedback posterior do usuário ou inspeção visual real.
