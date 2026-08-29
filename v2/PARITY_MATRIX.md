# LTS Health v2 — matriz objetiva de entrega

Este arquivo é de engenharia/produto e não aparece na interface do usuário. Por ser público, não contém datas, contagens, valores ou outros metadados pessoais de saúde. Gates que dependem de dados reais são executados somente em ambiente autenticado.

## Piso funcional recuperado da versão anterior

| Área | Piso mínimo | Estado v2 | Gate restante |
| --- | --- | --- | --- |
| Bio | histórico completo, gráfico por métrica, comparação livre entre duas datas, formulário de registro e detalhe de uma medição | implementado | validar sessão autenticada em desktop e mobile |
| Treinos | histórico de sessões, sessão → exercício → série, carga/repetições/unidade, volume por grupo, evolução por exercício e formulário detalhado | implementado e ampliado com calendário e telemetria registrada | validar sessão autenticada com o treino mais recente e sua hierarquia real |
| Evolução | composição longitudinal, segmentar por data e comparação, contexto de frequência de treinos | implementado e ampliado com massa magra/gordura segmentar, diferenças entre lados e mudanças consecutivas | validar renderização autenticada/mobile |
| Análise | resumo multidomínio e cruzamentos descritivos com limitações explícitas | implementado com períodos, cobertura e lacunas | validar cobertura real e estados parciais em sessão autenticada |
| Tratamentos | contexto histórico temporal | implementado de forma não operacional | validar busca e histórico real; manter sem doses, ciclos ou instruções |

## Extensões acima do piso anterior já presentes na v2

| Área | Capacidade | Estado |
| --- | --- | --- |
| Hoje | último treino, última bio, alimentação, atividade, sono, métricas disponíveis, exames e fontes | implementado e tolerante a falhas parciais; só mostra uma métrica quando existe registro |
| Timeline | treino, composição, exames, documentos, alimentação, atividade, métricas e tratamentos em ordem temporal | implementado com período, navegação anual, busca, filtros, carregar mais e salto para o registro correspondente |
| Saúde & exames | coleta, biomarcadores, referência, método, tendência somente com unidade compatível e documentos | implementado; longitudinal depende da cobertura existente no backend privado |
| Nutrição | histórico por período, dia, refeições, anos, meses e cobertura | implementado com navegação histórica, resumo mensal, distribuição descritiva e lacunas explícitas |
| Dados / Inbox | Apple Saúde, Polar, MyFitnessPal, Fleury, Einstein, upload privado, capacidade por fonte, resultado do processamento e backup estruturado | implementado; Apple usa parser especializado e as demais fontes mantêm o caminho estável |

## Regras que bloqueiam promoção para a raiz pública

1. Workflow principal da arquitetura verde no head candidato.
2. Browser smoke verde em desktop e viewport móvel.
3. Failure-state smoke verde: falha de uma fonte nunca vira `0` falso nem apaga áreas saudáveis.
4. Core-experience smoke verde: Bio, Treinos, Evolução, Análise e Tratamentos exercitados por interação.
5. Smokes dedicados de Timeline, Nutrição e Análise verdes no head candidato.
6. Sessão autenticada confirma que o treino mais recente aparece com a hierarquia de exercícios/séries esperada no backend privado.
7. Sessão autenticada confirma que a medição corporal mais recente exibida corresponde ao backend privado.
8. Navegação autenticada funciona em desktop e mobile sem overflow horizontal e sem abas mortas.
9. Nenhum texto de implementação aparece na interface normal.
10. Nenhum dado pessoal de saúde é copiado para o repositório público.
11. Uploads não Apple continuam em `health-inspect-upload`; Apple Saúde usa `health-inspect-upload-v2`, que aplica regras mais conservadoras para dados potencialmente sobrepostos.
12. Após cada deploy da candidata em `/v2/`, um browser smoke exercita a versão realmente servida pelo GitHub Pages, enquanto a raiz anterior permanece disponível como fallback.

## Fontes externas — critério de implementação

- **Apple Saúde:** preservar o ZIP original e normalizar somente métricas com regra explícita. Energia ativa, minutos de exercício, horas em pé e duração do sono têm caminho automático. Passos e frequência cardíaca de repouso entram somente em dias com uma única fonte identificada; dias ambíguos ficam retidos.
- **Polar Flow:** não criar segunda sessão para o mesmo treino. Usar detalhe complementar apenas quando o arquivo real permitir validar o mapeamento.
- **MyFitnessPal:** alimentação e atividade importadas permanecem separadas da sessão de treino estruturada. Ausência de período importado continua sendo lacuna, nunca zero.
- **Fleury / Einstein:** PDFs e imagens ficam preservados no Inbox. Extração especializada só é promovida após validação em amostras reais, sem inferir biomarcadores ou unidades ausentes.

## Próxima ordem de execução

1. Continuar refinamento visual e navegação das telas centrais sem reduzir conteúdo já validado.
2. Manter documentação pública sem dados pessoais e auditorias detalhadas apenas no backend privado.
3. Auditar parsers com arquivos reais quando estiverem disponíveis.
4. Manter a candidata v2 publicada em paralelo e validar cada deploy com browser real automatizado.
5. Rodar gate autenticado com dados reais em desktop e mobile.
6. Somente então promover a candidata para a raiz pública.
