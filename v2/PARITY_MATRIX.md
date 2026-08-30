# LTS Health v2 — matriz objetiva de entrega

Este arquivo é de engenharia/produto e não aparece na interface do usuário. Por ser público, não contém datas, contagens, valores ou outros metadados pessoais de saúde. Gates que dependem de dados reais são executados somente em ambiente autenticado.

## Piso funcional recuperado da versão anterior

| Área | Piso mínimo | Estado v2 | Gate restante |
| --- | --- | --- | --- |
| Bio | histórico completo, gráfico por métrica, comparação livre entre duas datas, formulário de registro e detalhe de uma medição | implementado; renderização autenticada mobile já conferida contra o backend privado | validar a mesma experiência autenticada em desktop |
| Treinos | histórico de sessões, sessão → exercício → série, carga/repetições/unidade, volume por grupo, evolução por exercício e formulário detalhado | implementado e ampliado com calendário e telemetria registrada | validar sessão autenticada com o treino mais recente e sua hierarquia real |
| Evolução | composição longitudinal, segmentar por data e comparação, contexto de frequência de treinos | implementado e ampliado com massa magra/gordura segmentar, diferenças entre lados e mudanças consecutivas | validar renderização autenticada/mobile |
| Análise | resumo multidomínio e cruzamentos descritivos com limitações explícitas | implementado com períodos, cobertura e lacunas | validar cobertura real e estados parciais em sessão autenticada |
| Tratamentos | contexto histórico temporal | implementado de forma não operacional | validar busca e histórico real; manter sem doses, ciclos ou instruções |

## Extensões acima do piso anterior já presentes na v2

| Área | Capacidade | Estado |
| --- | --- | --- |
| Hoje | último treino, última bio, alimentação, atividade, sono, métricas disponíveis, exames e fontes | implementado e tolerante a falhas parciais; só mostra uma métrica quando existe registro canônico compatível |
| Timeline | treino, composição, exames, documentos, alimentação, atividade, métricas e tratamentos em ordem temporal | implementado com período, navegação anual, busca, filtros, carregar mais e salto para o registro correspondente |
| Saúde & exames | coleta, biomarcadores, referência, método, tendência somente com unidade compatível e documentos | implementado; longitudinal depende da cobertura existente no backend privado |
| Nutrição | histórico por período, dia, refeições, anos, meses e cobertura | implementado com navegação histórica, resumo mensal, distribuição descritiva e lacunas explícitas |
| Dados / Inbox | Apple Saúde, Polar, MyFitnessPal, Fleury, Einstein, upload privado, capacidade por fonte, resultado do processamento e backup estruturado | implementado com inspetor estável único; parsers especializados ficam fora do fluxo normal até validação completa |

## Regras que bloqueiam promoção para a raiz pública

1. Workflow principal da arquitetura verde no head candidato.
2. Browser smoke verde em desktop e viewport móvel.
3. Failure-state smoke verde: falha de uma fonte nunca vira `0` falso nem apaga áreas saudáveis.
4. Core-experience smoke verde: Bio, Treinos, Evolução, Análise e Tratamentos exercitados por interação.
5. Smokes dedicados de Timeline, Nutrição e Análise verdes no head candidato.
6. Sessão autenticada confirma que o treino mais recente aparece com a hierarquia de exercícios/séries esperada no backend privado.
7. Sessão autenticada confirma que a medição corporal mais recente exibida corresponde ao backend privado. A conferência mobile já foi concluída; falta desktop.
8. Navegação autenticada funciona em desktop e mobile sem overflow horizontal e sem abas mortas.
9. Nenhum texto de implementação aparece na interface normal.
10. Nenhum dado pessoal de saúde é copiado para o repositório público.
11. O frontend mantém `health-inspect-upload` como inspetor de upload até que qualquer parser especializado passe validação completa e explícita.
12. Após cada deploy da candidata em `/v2/`, um browser smoke exercita a versão realmente servida pelo GitHub Pages, enquanto a raiz anterior permanece disponível como fallback.

## Fontes externas — critério de implementação

- **Apple Saúde:** promoção canônica automática fica limitada a ActivitySummary de energia ativa, minutos de exercício e horas em pé. Passos, FC de repouso, HRV, frequência respiratória, peso e sono podem ser preservados como candidatos por origem, mas não são promovidos automaticamente. Sono permanece fora da prontidão canônica até existir política validada de seleção de fonte e sobreposição; fontes diferentes nunca são somadas por suposição.
- **Polar Flow:** dados via Apple Saúde permanecem candidatos/complementares por origem. Não criar segunda sessão para o mesmo treino; usar detalhe complementar apenas quando a evidência real permitir validar o mapeamento.
- **MyFitnessPal:** via Apple Saúde, somente totais diários de energia, proteína, carboidratos, gordura e fibra são preservados como candidatos da própria fonte. Esses candidatos não viram nutrição canônica automaticamente e não geram alimentos, refeições ou horários inventados. Exports diretos continuam suportados para histórico e granularidade.
- **Fleury / Einstein:** arquivos ficam preservados no Inbox. Extração especializada só é promovida após validação em amostras reais, sem inferir biomarcadores ou unidades ausentes.

## Próxima ordem de execução

1. Continuar refinamento visual e navegação das telas centrais sem reduzir conteúdo já validado.
2. Manter documentação pública sem dados pessoais e auditorias detalhadas apenas no backend privado.
3. Auditar parsers com arquivos reais quando estiverem disponíveis.
4. Manter a candidata v2 publicada em paralelo e validar cada deploy com browser real automatizado.
5. Fechar o gate autenticado restante de treino e desktop.
6. Somente então promover a candidata para a raiz pública.
