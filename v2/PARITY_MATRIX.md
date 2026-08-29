# LTS Health v2 — matriz objetiva de entrega

Este arquivo é de engenharia/produto e não aparece na interface do usuário. Ele evita que o desenvolvimento volte a ser uma sequência de ajustes sem um critério de conclusão.

## Piso funcional recuperado do Claude

| Área | Piso mínimo | Estado v2 | Gate restante |
| --- | --- | --- | --- |
| Bio | histórico completo, gráfico por métrica, comparação livre entre duas datas, formulário de registro, detalhe de uma medição | implementado | backend confirma 24/08/2026 como medição mais recente; falta validar a sessão real no browser e mobile |
| Treinos | histórico de sessões, sessão → exercício → série, carga/repetições/unidade, volume por grupo, evolução por exercício, formulário detalhado | implementado e ampliado com calendário/telemetria | backend confirma treino de 27/08/2026 com 7 exercícios e 25 séries estruturadas; falta validar a sessão real no browser/mobile |
| Evolução | composição longitudinal, segmentar por data e comparação, contexto de frequência de treinos | implementado e ampliado com gordura segmentar, diferenças D−E e mudanças consecutivas | quatro medições segmentares reais conferidas e completas para massa magra e gordura; falta validar renderização autenticada/mobile |
| Análise | resumo multidomínio e cruzamentos descritivos com limitações explícitas | implementado e ampliado com período 30/90/365/todo histórico, resumo observado, cobertura e lacunas | validar cobertura real e estados parciais em sessão autenticada |
| Tratamentos | contexto histórico temporal | implementado de forma não operacional | validar busca e histórico real; manter sem doses/ciclos/instruções |

## Extensões acima do Claude já presentes na v2

| Área | Capacidade | Estado |
| --- | --- | --- |
| Hoje | último treino, última bio, alimentação, sono, exames e fontes | implementado, tolerante a falhas parciais |
| Timeline | treino, composição, exames, documentos, alimentação, atividade, métricas e tratamentos em ordem temporal | implementado com período, navegação anual, busca, filtros, carregar mais e salto para treino/bio/nutrição/coleta correspondente |
| Saúde & exames | coleta, biomarcadores, referência, método, tendência somente com unidade compatível, documentos | implementado; depende de novas coletas para longitudinal real |
| Nutrição | MyFitnessPal por período, dia, refeições, anos e cobertura histórica | implementado com navegação anual, detalhe de refeições e lacunas anuais explícitas; 2025 permanece marcado como sem registros disponíveis |
| Dados / Inbox | Apple Saúde, Polar, MyFitnessPal, Fleury, Einstein, upload privado, capacidade por fonte e resultado de processamento | implementado; leitura especializada de Polar/Fleury/Einstein ainda depende de arquivos reais e validação |

## Regras que bloqueiam publicação

A v2 não deve substituir o fallback público enquanto qualquer item abaixo estiver vermelho:

1. Workflow `LTS Health architecture v2` verde no head que será promovido.
2. Browser smoke verde em desktop e 390×844.
3. Failure-state smoke verde: falha de uma fonte nunca vira `0` falso nem apaga áreas saudáveis.
4. Core-experience smoke verde: Bio, Treinos, Evolução, Análise e Tratamentos exercitados por interação.
5. Smokes dedicados de Timeline, Nutrição e Análise verdes no head candidato.
6. Sessão autenticada no browser confirma que o treino de 27/08/2026 aparece com exercícios e séries estruturados. **Backend já conferido.**
7. Sessão autenticada no browser confirma que a bio de 24/08/2026 aparece como medição mais recente. **Backend já conferido.**
8. Navegação autenticada funciona em desktop e mobile sem overflow horizontal e sem abas mortas.
9. Nenhum texto de implementação aparece na interface normal.
10. Nenhum payload privado de saúde entra no repositório público.
11. Importador continua apontando para `health-inspect-upload`; não usar o inspector limitado `health-inspect-upload-v2`.
12. Após cada deploy da candidata em `/v2/`, um browser smoke deve exercitar a versão realmente servida pelo GitHub Pages em desktop e mobile, enquanto a raiz anterior permanece intacta.

## Fontes externas — critério de implementação

- **Apple Saúde:** manter o ZIP original e normalizar somente métricas com regra de consolidação validada. Hoje: energia ativa, minutos de exercício, horas em pé e duração do sono.
- **Polar Flow:** não criar uma segunda sessão se o mesmo treino já estiver representado no histórico principal. Usar Polar como detalhe complementar quando houver arquivo real que permita validar o mapeamento.
- **MyFitnessPal:** alimentação e atividade importadas permanecem separadas de sessão de treino estruturada. O preview de ingestão é exibido no Inbox sem expor payload bruto. Ausência de ano/dia importado continua sendo lacuna, nunca zero.
- **Fleury / Einstein:** PDFs/imagens ficam preservados no Inbox. Extração especializada só deve ser promovida após validação em amostras reais, sem inferir biomarcadores ou unidades ausentes.

## Próxima ordem de execução

1. Continuar o refinamento visual e de navegação das telas centrais sem reduzir o conteúdo já validado.
2. Auditar o parser por fonte com arquivos reais assim que existirem, mantendo o status explícito no Inbox.
3. Manter a candidata v2 publicada em paralelo à versão anterior e validar cada deploy com browser real automatizado.
4. Rodar o gate autenticado com dados reais em desktop e mobile quando houver uma sessão utilizável para QA.
5. Somente então promover a candidata para a raiz pública.
