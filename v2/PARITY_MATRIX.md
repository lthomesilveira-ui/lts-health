# LTS Health v2 — matriz objetiva de entrega

Este arquivo é público e não contém dados pessoais de saúde. A entrada principal já foi promovida ao cockpit v2 e validada em sessão autenticada real; esta matriz registra o piso que futuras releases não podem perder. A fila atual fica em `EXECUTION_STATE.json`.

## Piso funcional vigente

| Área | Capacidade preservada | Estado | Gate de regressão |
| --- | --- | --- | --- |
| Início | cockpit multidomínio, janelas recentes, último histórico esparso, leitura principal e rotas de aprofundamento | publicado e homologado | desktop/mobile, dados reais quando afetados, sem overflow |
| Composição | histórico, gráfico por métrica, comparação segura, detalhe de medição e segmentar quando disponível | implementado | não comparar origens incompatíveis; ausência não vira zero |
| Treinos | sessão → exercício → série, calendário, grupos, evolução e evidência complementar | implementado e validado no estado autenticado | zero órfãos; unidade preservada; nenhuma sessão duplicada por telemetria |
| Evolução | composição longitudinal, segmentar e ritmo de treino | implementado | comparações descritivas e somente entre pontos compatíveis |
| Insights | resumo multidomínio, cobertura por janela, sinais complementares por origem e lacunas | implementado | mesma janela para sinais frequentes; sem causalidade ou soma de fontes |
| Protocolos | cadastro de contexto e eventos históricos separados | implementado | sem inferir situação atual, causa ou orientação de uso |
| Timeline | eventos de todos os domínios com período, ano, busca, filtros e navegação | implementado | fonte e unidade preservadas; paginação e rotas funcionais |
| Exames | coletas, marcadores, referências, método, documentos e séries comparáveis | implementado | série apenas com marcador/origem/unidade compatíveis |
| Nutrição | histórico por dia/período, refeições, cobertura, conflitos e hidratação | implementado | conflito fail-closed; ausência não significa zero |
| Dados / Inbox | fontes, upload privado, processamento, proveniência, qualidade e backup verificável | implementado | responsabilidade do usuário separada de backlog interno; sem payload bruto |

## Gates de toda release

1. Workflow principal verde no head candidato.
2. Contratos afetados e browser smoke em desktop e mobile.
3. Falha de uma fonte não pode criar `0` falso nem apagar área saudável.
4. Navegação sem abas mortas ou overflow horizontal.
5. Nenhum texto técnico interno, credencial, payload ou dado pessoal em UI, teste ou documentação pública.
6. `health-inspect-upload` permanece o inspetor estável até um parser especializado passar validação explícita em originais reais.
7. Mudanças de comportamento com dados reais exigem E2E autenticado; mudanças públicas exigem smoke pós-deploy.
8. `EXECUTION_STATE.json` deve terminar sem item `ready` ou `in_progress` abandonado.

## Fronteiras das fontes

- **Apple Saúde:** promoção automática limitada a ActivitySummary de energia ativa, minutos de exercício e horas em pé. Demais sinais ficam separados por origem até regra validada.
- **Polar Flow:** pode complementar um treino comprovadamente correspondente; não cria uma segunda sessão canônica.
- **MyFitnessPal:** export direto é preferencial. Dados indiretos via Apple permanecem candidatos. O fluxo histórico de água usa export autenticado e importação idempotente; o formulário manual é só para uma data isolada.
- **Fleury / Einstein:** original preservado primeiro; estruturação especializada somente depois de validação real, sem inferir marcador, unidade, referência ou data.

## Estado de promoção

- O cockpit v2 é a entrada pública principal.
- A versão anterior permanece preservada em `legacy.html` como fallback auditável.
- Desenvolvimento continua em `architecture-v2` e chega a `main` por pull request e merge normal, nunca por force.
