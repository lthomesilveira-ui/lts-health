# LTS Health — contrato visual canônico do Dashboard

Status: referência obrigatória de produto para a Home do LTS Health.

A imagem aprovada pelo usuário é a autoridade visual. Este documento apenas registra os elementos observáveis da referência para impedir regressões. Se houver conflito, a imagem prevalece.

## Linguagem visual aprovada

- Sidebar fixa em azul-marinho escuro, separada visualmente do conteúdo principal.
- Canvas principal claro, quase branco com leve tom azulado. O conteúdo principal **não** usa fundo escuro.
- Tipografia de interface sans-serif; o título principal é grande, escuro e em peso forte. Não usar serif no Dashboard.
- Cards e módulos compactos, com cantos moderadamente arredondados, bordas muito suaves e sombra discreta.
- Cor tem função semântica: azul para composição, verde para treino, laranja para nutrição, violeta para recuperação e rosa/vermelho para exames.
- Densidade executiva: muita informação útil cabe na primeira tela desktop, sem parecer planilha nem dashboard SaaS genérico.

## Geometria da referência desktop

Referência de inspeção: 1536 × 864 px.

- Sidebar: aproximadamente 211 px de largura.
- Conteúdo principal: padding horizontal aproximado de 20–22 px.
- Cabeçalho: título no topo esquerdo; seletor de período no topo direito.
- Cinco cartões executivos na mesma linha, aproximadamente 146 px de altura, com cerca de 12 px entre eles.
- Leitura principal imediatamente abaixo, em um único bloco branco com acento azul à esquerda.
- Linha analítica principal com três módulos equivalentes: Treino, Nutrição e Composição corporal.
- Segunda linha com Sono e recuperação, Exames e Hidratação.
- Fechamento compacto com Resumo executivo, Pontos a revisar e Fontes.
- Em viewport de referência, o conjunto deve ocupar a primeira tela com ritmo semelhante à imagem aprovada, sem grandes vazios ou blocos desproporcionalmente altos.

## Cartões executivos

1. Composição: fundo azul muito claro.
2. Treinos: fundo verde muito claro.
3. Nutrição: fundo pêssego/laranja muito claro.
4. Recuperação: fundo violeta muito claro.
5. Exames: fundo rosa muito claro.

Cada cartão mostra dado atual, contexto/comparação segura e uma pequena indicação visual semântica. Os cards não são todos brancos e não usam faixas decorativas inferiores.

## Navegação

- Rail escuro contínuo à esquerda.
- Marca LTS Health no topo.
- Item ativo com preenchimento azul-marinho mais claro e acento azul.
- Itens inativos discretos em cinza-azulado.
- Estado privado/sincronizado fica visualmente secundário, próximo ao rodapé da rail.

## Composição obrigatória da Home

1. Cabeçalho com título, texto curto e seletor 30 dias / 90 dias / 1 ano / Histórico.
2. Cinco cartões executivos: Composição, Treinos, Nutrição, Recuperação e Exames.
3. Bloco de Leitura principal da janela.
4. Linha analítica: Treino, Nutrição e Composição.
5. Segunda linha: Recuperação/Sono, Exames e Hidratação.
6. Fechamento: Resumo executivo, Pontos a revisar e Fontes.
7. Gráficos somente quando respondem a uma pergunta real e sempre com escala/data legíveis.

## Mobile

- Preservar a linguagem clara do conteúdo; não transformar a Home em um produto escuro no celular.
- Seletor de período sempre acessível.
- Cards executivos podem quebrar para duas colunas e, em telas estreitas, uma coluna.
- Módulos analíticos e fechamento passam para uma coluna vertical por scroll, sem overflow horizontal.
- Navegação inferior pode permanecer desde que não cubra conteúdo.

## Gate de homologação

Nenhuma versão é considerada pronta apenas por CI verde. Antes de promover ao `main` é obrigatório:

- renderizar a Home em 1536 × 864 e em viewport mobile;
- conferir sidebar, canvas claro, tipografia sans-serif, cinco cartões coloridos, leitura principal, duas linhas analíticas e fechamento;
- medir ausência de overflow horizontal;
- verificar que a sidebar permanece próxima de 211 px no desktop de referência;
- verificar que o fundo do canvas e as cinco famílias de cor dos cartões correspondem à referência;
- validar funcionamento e dados reais sem degradar a composição;
- preservar os testes funcionais e de proveniência existentes.

A imagem aprovada prevalece sobre qualquer regra textual ou teste caso uma futura implementação volte a divergir visualmente.