# LTS Health — contrato visual canônico do Dashboard

Status: referência obrigatória de produto para a Home do LTS Health.

A imagem aprovada pelo usuário continua sendo a autoridade visual. Este documento registra as características não negociáveis extraídas dessa referência para impedir que testes funcionais ou layouts apenas aproximados sejam confundidos com fidelidade visual.

## Linguagem visual

- Canvas principal em azul-marinho muito escuro, com contraste sofisticado e pouca decoração.
- Sidebar fixa e discreta integrada ao mesmo campo escuro do produto.
- Cards brancos grandes, com cantos arredondados, sombra suave e bastante espaço interno.
- Tipografia de exibição serifada nos títulos e números de maior hierarquia; tipografia sem serifa apenas para navegação, rótulos e texto de apoio.
- Composição arejada, premium e executiva, com espaço negativo suficiente entre blocos.
- Cor tem função semântica. Não usar arco-íris decorativo nem competir com o conteúdo.

## Composição obrigatória da Home

1. Cabeçalho simples com título, texto curto de contexto e seletor de período claramente visível.
2. Cinco cartões executivos no topo: Composição, Treino, Nutrição, Recuperação e Exames.
3. Cada cartão deve mostrar estado atual, mudança/comparação quando segura e cobertura/contexto.
4. Bloco de Leitura principal imediatamente abaixo dos cinco cartões.
5. Linha analítica principal com três módulos equivalentes: Treino, Nutrição e Composição.
6. Segunda linha com Recuperação/Sono, Saúde & Exames e Hidratação.
7. Fechamento com Resumo executivo, Próximas revisões e Fontes.
8. Gráficos somente quando respondem a uma pergunta real e sempre com escala/data legíveis.

## Proporções e ritmo

- Desktop: rail fixo estreito + canvas flexível; cinco cartões na mesma linha em viewport amplo; três módulos analíticos na mesma linha; espaçamento de 16–24 px entre cartões e blocos; raios generosos de 17–20 px.
- O conteúdo não deve parecer uma planilha, uma coleção de cards equivalentes ou um dashboard SaaS genérico claro.
- O título principal deve ter presença editorial e não aparência de heading utilitário.
- Cards precisam respirar: evitar texto comprimido, fontes minúsculas ou excesso de micro-métricas.

## Mobile

- Preservar o mesmo sistema visual escuro + cards brancos, não criar um produto visualmente diferente.
- O seletor de período continua visível.
- Cards executivos podem quebrar para duas colunas e, em telas estreitas, uma coluna; legibilidade tem prioridade sobre replicar a grade desktop.
- Módulos analíticos e fechamento passam para uma coluna vertical alcançável por scroll, sem overflow horizontal.
- Navegação inferior pode permanecer, desde que não cubra o conteúdo.

## Gate de homologação

Nenhuma versão volta ao usuário como pronta apenas porque CI, smoke ou E2E passaram. Antes de homologação é obrigatório:

- capturar render desktop e mobile;
- conferir lado a lado com a imagem aprovada;
- verificar sidebar, fundo, tipografia, cinco cards, leitura principal, linhas analíticas, fechamento, proporções, espaçamento e densidade;
- validar funcionamento e dados reais sem degradar a composição;
- nunca usar 9/10 ou 10/10 apenas para significar testes verdes.

A imagem aprovada prevalece sobre este texto caso qualquer detalhe visual entre em conflito.
