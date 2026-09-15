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
| FB-001 | 26/08 | O produto deve ser um assistente de saúde completo, longitudinal e capaz de identificar lacunas. | A abertura produz leitura, mudança, cobertura e prioridades; não apenas números. | Entregue parcialmente | Arquitetura e abertura entregues; integrações que dependem de terceiros permanecem bloqueadas no ledger. |
| FB-002 | 26/08 | Centralizar Apple Saúde, Polar, MyFitnessPal, bioimpedância, exames, documentos, treinos e contexto de tratamentos. | Fontes distintas entram em domínios ligados por Timeline e visão longitudinal. | Entregue parcialmente | `PROJECT_BRIEF.md`; telas e camada de dados existentes; integrações externas permanecem no ledger. |
| FB-003 | 28/08 | A aplicação anterior é o piso, não o resultado final. | Preservar capacidades e proveniência enquanto a experiência evolui além da implementação original. | Entregue neste pacote | Arquitetura por jornadas, Home de decisão e camadas legadas removidas da execução ativa. |
| FB-004 | 04/09 | A imagem aprovada é a referência visual canônica. | A imagem privada prevalece sobre contrato textual, implementação e testes. | Entregue tecnicamente | Original recuperado no Drive privado, hash preservado e comparação direta registrada em `v2/releases/PUBLIC_AUDIT_QA_20260915.md`; aceite subjetivo continua separado. |
| FB-005 | 04–05/09 | Não reiniciar nem perder o estado real já construído. | Evoluir por migração compatível, sem sobrescrever histórico, dados ou branches. | Entregue | `CONTINUITY_PROTOCOL.md`; políticas de merge e proveniência. |
| FB-006 | 28/08 | Área azul e textos sem sentido não podem permanecer. | Cor precisa ter função; copy deve explicar a decisão ou o estado. | Entregue | Canvas claro, famílias semânticas por domínio e ações específicas no build público `product-architecture-20260908.3`. |
| FB-007 | 28/08 | O app abriu sem carregar conteúdo. | Loading, falha parcial e sessão precisam ser distinguíveis e testados. | Entregue | Estados explícitos e jornadas revalidadas em browser desktop/mobile. |
| FB-008 | 29/08 | Fotos/rotas prometidas não carregavam e correções não apareciam. | Não declarar correção sem validar a superfície pública real. | Regra permanente | Gate de deploy público em `PRODUCT_ARCHITECTURE.md` e `CONTINUITY_PROTOCOL.md`. |
| FB-009 | Histórico | Nenhum dado ou implementação útil pode ser perdido. | Preservação da fonte, backup verificável, migrações e merge sem force. | Entregue | `DATA_AUDIT.md`; `BACKUP_TRACEABILITY_CONTRACT.md`; políticas do ledger. |
| FB-010 | Histórico | O usuário não deve servir como QA de microentregas. | Pacotes coerentes passam QA desktop/mobile antes da apresentação. | Regra permanente | `PRODUCT_ARCHITECTURE.md`; release gates. |
| FB-011 | 08/09 | Histórico de água não pode exigir digitação diária; conexão direta ao MyFitnessPal é preferível. | Transferência histórica em lote agora; OAuth oficial quando houver acesso do provedor. | Entregue parcialmente | Fluxo autenticado em lote; `LTS-HYD-IMPORT-001` e `LTS-MFP-OAUTH-001`. |
| FB-012 | 08/09 | Briefing, pendências e implementação não podem depender da memória do chat. | Arquitetura, feedbacks e fila operacional ficam versionados. | Entregue neste pacote | `PRODUCT_ARCHITECTURE.md`; este ledger; `EXECUTION_STATE.json`. |
| FB-013 | 08/09 | O link publicado ainda está longe do ideal. | Reabrir conclusão visual; testes antigos deixam de equivaler a homologação de produto. | Tratado tecnicamente | Build público identificado e inspecionado; densidade desktop, contraste e cache de ativos corrigidos. Aceite subjetivo não é presumido. |
| FB-014 | 08/09 | A interface parece um apanhado de coisas já rejeitadas. | Organizar a experiência por perguntas e jornadas, remover redundâncias e peso visual uniforme. | Entregue neste pacote | Navegação por intenção; leitura/prioridades antes da evidência; destinos com cabeçalho e retorno compartilhados. |
| FB-015 | 08/09 | No celular a Home continua parecendo módulos empilhados, não um aplicativo pensado para acompanhar evolução. | Substituir o dashboard longo por uma visão compacta com seletor único de evolução, resumo da janela, acontecimentos recentes e aprofundamento por área. | Entregue | PR #216; gates desktop/mobile 34228093456 e 34228093464; build público `longitudinal-home-20260908.4`. |
| FB-016 | 08/09 | A melhora da Home não basta: as telas internas ainda parecem relatórios empilhados, perdem o período escolhido e usam textos mecânicos. | Aplicar um único sistema de UX em todas as jornadas: janela global, resposta antes do detalhe, exploração progressiva, estados vazios únicos e linguagem natural. | Entregue | PR #228; PR #238; PR #239; build público `ux-coherence-20260908.14`; gates desktop/mobile e smokes públicos concluídos. Aceite subjetivo não é presumido. |
| FB-017 | 09/09 | Mesmo após o pacote de coerência, o app ainda parece distante do modelo de UX criticado e continua com aparência de dashboard web genérico. | Compactar a primeira tela, integrar a barra utilitária ao canvas, reduzir repetição e usar a mesma escala de densidade nas rotas internas. | Entregue tecnicamente | PR #241; build público `ux-coherence-20260909.16`; gates desktop/mobile e inspeção pública concluídos. Aceite subjetivo e paridade pixel não são presumidos. |
| FB-020 | 15/09 | CI, E2E e deploy não provam que o produto publicado foi realmente visto; o proprietário não pode continuar sendo o QA básico. | Toda entrega visual precisa abrir o link público final, autenticar quando possível, navegar, comparar com a referência em desktop/mobile e corrigir defeitos óbvios antes de pedir homologação. | Entregue neste pacote | PRs #285–#292; build público `.26` aberto no Cloud Browser; 32 capturas autenticadas revisadas; `v2/releases/PUBLIC_AUDIT_QA_20260915.md`. Aceite do proprietário não é presumido. |
| FB-021 | 15/09 | A versão `.26` aberta no iPhone físico continua grande, recortada e distante da densidade da referência; Home e Treino exibem vazios estruturais. | Tratar as oito capturas físicas como rejeição P0, corrigir a grade da Home, remover reservas duplicadas, compactar o viewport reduzido e transformar `393 × 650` em gate permanente. | Em execução | `PKG-HOME-DASHBOARD-REFERENCE-REBUILD-001`; `v2/physical-iphone-remediation-20260915.css`; `v2/physical-iphone-layout-smoke.mjs`. A inspeção pública do candidato `.30` ainda é obrigatória. |
| FB-022 | 15/09 | Um treino novo precisa entrar no produto sem que uma gravação parcial de dispositivo pareça representar a sessão completa. | Preservar o treino canônico e suas séries no banco privado; apresentar energia extrapolada como estimativa e frequência cardíaca como trecho parcial, mantendo a fonte estruturada. | Em execução | `PKG-HOME-DASHBOARD-REFERENCE-REBUILD-001`; `v2/src/workout-evidence.js`; `v2/src/training-reference-v2.js`; `v2/workout-source-evidence-smoke.mjs`. |
| FB-023 | 15/09 | O build `.29` continua sem entregar o dashboard combinado; o proprietário não fará novas rodadas de QA básico e exige um plano com começo, meio e fim. | Reconstruir a Home a partir da primeira tela da referência aprovada: cabeçalho, três métricas, Hoje, progresso semanal, evolução com oito métricas, seis domínios, acontecimentos e proveniência; publicar e fazer o QA público antes do próximo pedido de julgamento. | Em execução | `PKG-HOME-DASHBOARD-REFERENCE-REBUILD-001`; candidato `home-dashboard-reference-20260915.30`; `v2/home-dashboard-reference-smoke.mjs`. Aceite do proprietário não é presumido. |

## Dívidas identificadas pela auditoria

| ID | Problema | Impacto | Tratamento |
| --- | --- | --- | --- |
| D-001 | Quatro camadas de CSS e dois scripts pós-processavam a Home para perseguir a referência. | Layout frágil, tipografia comprimida e difícil manutenção. | Concluído: `cockpit.css` e `today-screen.js` são canônicos; camadas e pós-processadores antigos não carregam. |
| D-002 | Testes verificavam presença de seções, não prioridade, legibilidade ou trabalho do usuário. | Um dashboard tecnicamente completo podia continuar errado como produto. | Concluído: contratos estático, de jornadas e visual medem hierarquia, leitura, densidade e responsividade. |
| D-003 | `Evolução`, `Histórico`, `Insights` e áreas de domínio competiam sem agrupamento. | Carga cognitiva e navegação sem modelo mental claro. | Concluído: navegação agrupada; Evolução permanece apenas como detalhe compatível. |
| D-004 | “Ver mais” repetido e resumo duplicado em vários blocos. | Ações sem propósito e sensação de coleção de cards. | Concluído: ações nomeiam o destino e a Home separa leitura, prioridades, evidência e fontes. |
| D-005 | A tela de login podia expor partes do shell em alguns estados. | Entrada com aparência inacabada. | Concluído: entrada isolada, proposta de valor visível e contrato desktop/mobile. |
| D-006 | A imagem visual aprovada não estava preservada como artefato recuperável. | Impossibilidade de comparação direta e risco de regressão por memória. | Concluído: original preservado no Drive privado, identidade fixada por SHA256 e precedência registrada. O arquivo privado não é copiado ao repositório público. |
| D-007 | Uma falha transitória no primeiro carregamento da composição fazia a Home renderizar traços apesar de os registros reais existirem; uma atualização manual recuperava o domínio. | O usuário via ausência falsa e podia concluir que dados históricos tinham sido perdidos. | Correção candidata: repetir uma vez a leitura antes de declarar falha, manter erro distinto de ausência e proteger o comportamento nos contratos da Home. |

## Regra de reconciliação

Ao fim de cada pacote, os IDs afetados são atualizados aqui e vinculados a tarefas/evidências de `EXECUTION_STATE.json`. Nenhuma alegação antiga de “10/10” substitui feedback posterior do usuário ou inspeção visual real.

## Continuidade e profundidade funcional — 13/09/2026

- FB-018: layout atual parece adequado, mas há pouco histórico e funcionalidade acessível. Issue #265. Estado: em execução em `PKG-FUNCTIONAL-DEPTH-001`; preservar o visual e remover os limites silenciosos por meio de busca, paginação e detalhe progressivo.
- FB-019: continuar ao máximo e permitir retomada por qualquer agente sem depender do chat. Estado: pacote, fila e fonte visual reconciliados; evidência final depende da promoção verificada.
- D-001 permanece dívida técnica reaberta para as rotas estruturais: o runtime ainda coordena a renderização assíncrona legada. O pacote protege prontidão de domínio e dados atualizados, sem alegar que o pós-processador foi removido.
- D-006 resolvida quanto à recuperação da fonte: original guardado em Drive privado, com hash em `REFERENCE_VISUAL_CONTRACT.md`. Isso não equivale a paridade ou aceitação final.

Home/Treinos/Composição/Exames foram promovidos tecnicamente até os PRs #263/#264. Os estados antigos de “Entregue” acima são históricos e não encerram as novas lacunas da issue #265. Histórico de água, integrações e segurança de conta preservam os bloqueios do ledger.

## Auditoria pública e fechamento transversal — 15/09/2026

- FB-018 e `LTS-REMAINING-DOMAINS-001` foram concluídos tecnicamente: histórico e drill-downs permanecem acessíveis, e Timeline, Nutrição/Hidratação, Recuperação/Análises e consistência transversal entraram no QA autenticado final.
- FB-019 foi concluído quanto à continuidade: o estado final, a referência, o artefato criptografado e as evidências de promoção estão registrados fora da memória do chat.
- FB-020 formaliza a correção de processo, mas a evidência física posterior demonstrou que a revisão remota da `.26` não foi suficiente.
- FB-021 prevalece sobre o fechamento anterior: `.26` está rejeitada; nenhum CI ou screenshot remoto substitui o resultado observado no iPhone físico.
- Nenhum desses estados significa que o proprietário aprovou a experiência em iPhone físico ou declarou paridade pixel.
