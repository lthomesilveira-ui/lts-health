# LTS Health — visão canônica de produto

**Status:** regra permanente do projeto, aprovada em 04/09/2026.

## Definição do produto

LTS Health não é um repositório de dados de saúde e não é uma página com cartões soltos. É um **cockpit executivo longitudinal + assistente de saúde orientado por evidência registrada**.

A experiência deve permitir que o usuário, um nutricionista, treinador ou profissional de saúde autorizado entenda rapidamente:

1. como está a composição corporal;
2. como estão os treinos e a progressão de performance;
3. como está a nutrição e qual é a cobertura real dos registros;
4. como estão atividade, sono e recuperação, mantendo fontes separadas quando necessário;
5. como estão os exames e quais biomarcadores têm histórico comparável;
6. o que mudou no período selecionado;
7. onde faltam dados e o que precisa ser revisado no próprio sistema.

## Referência visual aprovada

A referência aprovada é um dashboard claro, executivo e limpo, com:

- cabeçalho simples + filtro de período visível;
- cinco domínios executivos no topo: Treino, Nutrição, Composição, Saúde/Exames e Recuperação;
- cada domínio mostra **estado atual + mudança/comparação + cobertura/contexto**;
- um bloco de **Leitura principal / Insight principal** logo abaixo;
- módulos analíticos com gráficos apenas quando respondem a uma pergunta real;
- segunda linha com recuperação/sono, exames e hidratação;
- resumo executivo, pontos a revisar e fontes de dados no fechamento;
- design neutro, com cor usada para significado e hierarquia, não como decoração.

## Regras de conteúdo

### Composição corporal
- Mostrar última medição e mudança somente entre pontos comparáveis.
- Exibir peso, massa muscular, massa de gordura e percentual de gordura quando existentes.
- Mudança de origem quebra continuidade automática.

### Treinos
- Mostrar sessões na janela e comparação com período anterior equivalente.
- Mostrar distribuição por grupo muscular estruturado.
- Mostrar progressão de performance apenas para exercício + máquina + unidade comparáveis.
- Não usar calorias/telemetria complementar para criar sessão duplicada.

### Nutrição
- Mostrar dias registrados sobre dias possíveis da janela, não apenas contagem bruta histórica.
- Mostrar médias de energia/macros somente de dias inequívocos.
- Dias ambíguos ficam fora das médias e devem ser explicitados.

### Hidratação
- Se não houver ingestão real de água: **“Sem registro de ingestão de água”**.
- Água corporal de bioimpedância nunca é ingestão/hidratação.
- Nunca estimar ou preencher água para completar o cockpit.

### Sono, atividade e recuperação
- Sono e sinais complementares permanecem separados por origem enquanto não houver regra de consolidação validada.
- Nenhuma média entre dispositivos por suposição.
- Atividade Apple canônica continua limitada às métricas já autorizadas pela arquitetura.

### Exames
- Mostrar datas de coleta, cobertura e tendências apenas quando biomarcador + origem + unidade forem comparáveis.
- Não classificar automaticamente um resultado como clínico “normal/anormal” sem regra validada e referência apropriada.

### Protocolos
- Permanecem como contexto temporal/histórico.
- Não inferir uso atual, causalidade ou orientação de alteração de protocolo.

## Regras para gráficos

Um gráfico só entra se responder uma pergunta. Todo gráfico precisa ter:

- período selecionável ou herdar claramente o filtro global;
- datas legíveis;
- unidade/escala;
- domínio e significado claros;
- fonte/proveniência preservada quando relevante.

Gráficos de “quantidade de dados” sem utilidade analítica não pertencem ao cockpit principal.

## Regra de insights

O cockpit deve produzir leitura, não apenas números. Exemplos válidos:

- “X sessões nos últimos 30 dias vs Y nos 30 dias anteriores.”
- “Nutrição registrada em X de Y dias; cobertura Z%.”
- “Entre duas medições corporais comparáveis, massa muscular mudou A kg e massa de gordura B kg.”
- “Sono existe em duas origens e permanece separado; não há média consolidada.”

Não transformar associação temporal em causalidade.

## Definição de pronto para Home

A Home só pode ser considerada cockpit quando:

- existe filtro global de 30d / 90d / 1 ano / histórico;
- os cinco domínios executivos aparecem no topo;
- cada domínio traz estado + mudança/contexto + cobertura;
- hidratação ausente é explícita e sem gráfico fictício;
- há uma leitura principal da janela;
- treino, nutrição e composição têm módulos analíticos úteis;
- recuperação, exames e hidratação têm blocos próprios;
- resumo executivo e limitações são legíveis;
- desktop e mobile passam smoke sem overflow;
- nenhuma fronteira de proveniência/canonicalidade é quebrada.

## Método de trabalho permanente

- Priorizar entregas testáveis de produto, não narrar CI como se fosse entrega.
- Trabalhar em pacotes coerentes com impacto visível.
- Antes de adicionar um card, gráfico ou métrica, responder: **qual pergunta do usuário isso resolve?**
- Preservar esta visão em handoffs e lista-mestra; chats novos não podem reiniciar a definição do produto.
- Infraestrutura já construída deve ser reutilizada como base, mas não pode determinar a experiência visual.
