# LTS Health — referência visual e histórico dos contratos

Status: referência obrigatória de produto para a Home do LTS Health.

A imagem aprovada pelo usuário é a autoridade visual. Este documento apenas registra os elementos observáveis da referência para impedir regressões. Se houver conflito, a imagem prevalece.

## Fonte recuperada e precedência — 13/09/2026

A imagem mobile aprovada foi recuperada, inspecionada e preservada em Drive privado sob o nome `LTS Health - referencia visual aprovada.png`. SHA256: `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`.

O arquivo contém detalhes pessoais e exemplos ilustrativos; não deve ser copiado para o repositório público. Um agente autorizado deve obter o original no Drive privado do proprietário. Os valores, metas e exemplos da imagem não são dados de produção nem instruções de saúde a implementar.

A imagem reúne três telas mobile: resumo pessoal com hierarquia compacta; detalhe de sessão com métricas e abas; exercícios com séries legíveis. A implementação `.26` preservou parte dessa estrutura, mas foi rejeitada após inspeção em iPhone físico: densidade, recortes e vazios ainda divergiam materialmente. Isso não autoriza reiniciar cores, arquitetura, dados ou funcionalidades válidas.

## Evidência física e viewport reduzido — 15/09/2026

O navegador usado no iPhone deixou aproximadamente `393 × 650` CSS px de área útil, menor que o viewport limpo de `390 × 844` usado pelos gates anteriores. A Home não pode manter uma linha reservada para topbar quando a topbar está oculta; nenhuma rota pode repetir no conteúdo a altura já destinada à navegação inferior. Home deve expor cabeçalho, métricas, Hoje e Progresso semanal nessa área reduzida, mantendo o panorama longitudinal logo na sequência. Treino e demais áreas devem terminar sem faixas vazias desproporcionais.

Os parágrafos desktop abaixo preservam a referência histórica anterior, não podem anular a direção mobile posterior nem justificar uma volta ao dashboard rejeitado. Precedência: imagem privada aprovada + feedback mais recente > implementação publicada aceita direcionalmente > contrato histórico. Não declarar paridade exata sem comparação visual e aceite explícito.

## Linguagem visual aprovada

- Sidebar fixa em azul-marinho escuro, separada visualmente do conteúdo principal.
- Canvas principal claro, quase branco com leve tom azulado. O conteúdo principal **não** usa fundo escuro.
- Tipografia de interface sans-serif; o título principal é grande, escuro e em peso forte. Não usar serif no Dashboard.
- Cards e módulos compactos, com cantos moderadamente arredondados, bordas muito suaves e sombra discreta.
- Cor tem função semântica: azul para composição, verde para treino, laranja para nutrição, violeta para recuperação e rosa/vermelho para exames.
- Densidade executiva: muita informação útil cabe na primeira tela desktop, sem parecer planilha nem dashboard SaaS genérico.

## Geometria da referência desktop

Referência de inspeção: 1536 × 864 px.

- Sidebar: aproximadamente 211 px na referência histórica. Enquanto a imagem-fonte não estiver versionada, a implementação pode usar de 208 a 268 px para preservar rótulos agrupados e legibilidade, sem alterar a proporção dominante do canvas.
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

A primeira tela mobile da imagem privada prevalece sobre a composição desktop histórica. Sua ordem reconhecível é:

1. marca, saudação, data e contexto curto;
2. três métricas compactas de composição corporal: peso, gordura e massa magra;
3. cartão `Hoje` com treino, tratamentos, hidratação e alimentação;
4. progresso semanal em quatro anéis compactos;
5. evolução longitudinal com períodos 30 dias / 90 dias / 1 ano / Histórico e métricas Peso, Gordura, Músculo, Treinos, Nutrição, Sono, Exames e Água;
6. panorama dos demais domínios em uma faixa horizontal, seguido por acontecimentos recentes e contexto das fontes.

No desktop, o mesmo conteúdo pode ser reorganizado para aproveitar largura: `Hoje` e progresso semanal formam uma coluna ao lado da evolução, os seis domínios ficam em uma faixa e o fechamento divide acontecimentos e proveniência. Isso não autoriza substituir a hierarquia mobile por cinco cartões executivos genéricos.

Gráficos aparecem somente quando respondem a uma pergunta real e sempre com escala/data legíveis.

## Mobile

- A Home usa o canvas azul-marinho escuro observado na imagem aprovada, com cartões brancos de alto contraste; telas internas preservam superfícies claras quando essa é a hierarquia mais legível.
- Marca, saudação, data, métricas, `Hoje` e progresso semanal precisam ser reconhecíveis sem aparência de dashboard web comprimido.
- Seletor de período permanece acessível na evolução longitudinal.
- Os seis domínios formam uma única faixa horizontal com gesto nativo e snap; não podem virar uma longa pilha vertical.
- O seletor de métricas da evolução é horizontal e legível.
- Acontecimentos e contexto das fontes passam para uma coluna; os detalhes permanecem nas áreas especializadas.
- Navegação inferior pode permanecer desde que não cubra conteúdo.

## Gate de homologação

Nenhuma versão é considerada pronta apenas por CI verde. Antes de promover ao `main` é obrigatório:

- renderizar a Home em 1536 × 864 e em viewport mobile;
- conferir no desktop rail, canvas claro, três métricas, `Hoje`, progresso, evolução, seis domínios e fechamento compacto;
- conferir no mobile canvas escuro, cartões brancos, a ordem exata da primeira tela aprovada e navegação inferior sem cobertura;
- medir ausência de overflow horizontal;
- verificar que a sidebar permanece dentro da faixa documentada e que o canvas continua dominante no desktop;
- verificar que o contraste do canvas e as famílias semânticas dos cartões correspondem à referência em cada viewport;
- validar funcionamento e dados reais sem degradar a composição;
- preservar os testes funcionais e de proveniência existentes.

Depois da publicação e antes de pedir homologação ao proprietário também é obrigatório abrir o link público final em Cloud Browser, confirmar o build entregue, autenticar quando possível, navegar pelo conteúdo real e corrigir defeitos óbvios observados. Evidência mobile autenticada deve ser inspecionada em tamanho legível; uma miniatura ou contact sheet isolada não basta para resolver ambiguidade visual.

A imagem aprovada e a evidência em iPhone físico prevalecem sobre qualquer regra textual, teste ou screenshot remoto caso uma futura implementação volte a divergir visualmente.
