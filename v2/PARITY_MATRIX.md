# LTS Health v2 — matriz objetiva de entrega

Este arquivo é de engenharia/produto e não aparece na interface do usuário. Ele evita que o desenvolvimento volte a ser uma sequência de ajustes sem um critério de conclusão.

## Piso funcional recuperado do Claude

| Área | Piso mínimo | Estado v2 | Gate restante |
| --- | --- | --- | --- |
| Bio | histórico completo, gráfico por métrica, comparação livre entre duas datas, formulário de registro, detalhe de uma medição | implementado | validar com dados reais autenticados e mobile |
| Treinos | histórico de sessões, sessão → exercício → série, carga/repetições/unidade, volume por grupo, evolução por exercício, formulário detalhado | implementado | validar treino real mais recente e navegação mobile autenticada |
| Evolução | composição longitudinal, segmentar por data e comparação, contexto de frequência de treinos | implementado | validar as quatro medições segmentares reais |
| Análise | resumo multidomínio e cruzamentos descritivos com limitações explícitas | implementado | validar cobertura real e estados parciais autenticados |
| Tratamentos | contexto histórico temporal | implementado de forma não operacional | validar busca e histórico real; manter sem doses/ciclos/instruções |

## Extensões acima do Claude já presentes na v2

| Área | Capacidade | Estado |
| --- | --- | --- |
| Hoje | último treino, última bio, alimentação, sono, exames e fontes | implementado, tolerante a falhas parciais |
| Timeline | treino, composição, exames, documentos, alimentação, atividade, métricas e tratamentos em ordem temporal | implementado; ampliar navegação de histórico se necessário |
| Saúde & exames | coleta, biomarcadores, referência, método, tendência somente com unidade compatível, documentos | implementado; depende de novas coletas para longitudinal real |
| Nutrição | MyFitnessPal por período, dia, refeições, anos e cobertura histórica | implementado; navegação anual em evolução |
| Dados / Inbox | Apple Saúde, Polar, MyFitnessPal, Fleury, Einstein, upload privado e status | implementado; parsers especializados ainda dependem de arquivos reais |

## Regras que bloqueiam publicação

A v2 não deve substituir o fallback público enquanto qualquer item abaixo estiver vermelho:

1. Workflow `LTS Health architecture v2` verde no head que será promovido.
2. Browser smoke verde em desktop e 390×844.
3. Failure-state smoke verde: falha de uma fonte nunca vira `0` falso nem apaga áreas saudáveis.
4. Core-experience smoke verde: Bio, Treinos, Evolução, Análise e Tratamentos exercitados por interação.
5. Sessão autenticada com dados reais confirma que o treino de 27/08/2026 aparece com exercícios e séries estruturados.
6. Sessão autenticada com dados reais confirma que a bio de 24/08/2026 aparece como medição mais recente.
7. Navegação autenticada funciona em desktop e mobile sem overflow horizontal e sem abas mortas.
8. Nenhum texto de implementação aparece na interface normal.
9. Nenhum payload privado de saúde entra no repositório público.
10. Importador continua apontando para `health-inspect-upload`; não usar o inspector limitado `health-inspect-upload-v2`.

## Fontes externas — critério de implementação

- **Apple Saúde:** manter o ZIP original e normalizar somente métricas com regra de consolidação validada. Hoje: energia ativa, minutos de exercício, horas em pé e duração do sono.
- **Polar Flow:** não criar uma segunda sessão se o mesmo treino já estiver representado no histórico principal. Usar Polar como detalhe complementar quando houver arquivo real que permita validar o mapeamento.
- **MyFitnessPal:** alimentação e atividade importadas permanecem separadas de sessão de treino estruturada.
- **Fleury / Einstein:** PDFs/imagens ficam preservados no Inbox. Extração especializada só deve ser promovida após validação em amostras reais, sem inferir biomarcadores ou unidades ausentes.

## Próxima ordem de execução

1. Fechar regressões e navegação do histórico completo de Nutrição/Timeline.
2. Refinar Bio/Treinos/Evolução até a experiência ser claramente igual ou superior ao piso Claude.
3. Auditar o parser de upload por fonte e preparar parsers especializados sem prometer suporte antes de teste real.
4. Rodar gate autenticado com dados reais.
5. Somente então criar candidata de promoção para o site público.
