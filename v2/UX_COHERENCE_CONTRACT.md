# LTS Health — contrato de coerência de UX

Status: contrato operacional do pacote `PKG-UX-COHERENCE-001`. Este documento é público e não contém dados pessoais de saúde.

## Resultado esperado

O LTS Health deve parecer um único aplicativo longitudinal, não uma coleção de relatórios. Cada rota responde primeiro à pergunta principal da área, mantém o contexto escolhido e oferece detalhe apenas quando solicitado.

## Regras canônicas

1. **Uma janela do produto.** Início, Treinos, Nutrição e Recuperação & análises compartilham `30 dias`, `90 dias`, `1 ano` ou `Todo o histórico`. A troca em qualquer uma dessas telas atualiza as demais.
2. **Uma referência temporal.** Janelas recentes terminam no último dia conhecido do conjunto carregado. A ausência de eventos depois desse dia não desloca silenciosamente a leitura para a data do navegador.
3. **Resposta antes da evidência.** Cada área começa com um cabeçalho de estado, até quatro fatos de contexto e uma visualização ou lista prioritária.
4. **Detalhe progressivo.** Comparações, tabelas extensas, documentos, calendários e proveniência detalhada ficam em controles nativos expansíveis e acessíveis.
5. **Um estado vazio.** Quando não há registros na janela, a tela mostra uma única explicação e, se houver histórico anterior, uma ação para ampliar o período. Módulos vazios dependentes não são renderizados.
6. **Linguagem humana.** Contagens respeitam singular e plural em português. Textos como `sessão(ões)`, `dia(s)`, `resultado(s)` e `origem(ns)` são proibidos nas rotas principais.
7. **Integridade intacta.** Ausência não vira zero; origens incompatíveis não são combinadas; comparações continuam conservadoras e descritivas.
8. **Mobile como produto.** Controles têm alvo mínimo de 44 px, cartões-resumo podem deslizar horizontalmente, não há overflow da página e cada rota abre no topo. Cabeçalho, conteúdo e navegação ocupam linhas próprias da grade, sem sobreposição.
9. **Contraste verificável.** As superfícies canônicas das rotas usam o mesmo tema claro do Início. Títulos, textos de apoio, resumos e seções progressivas precisam atingir ao menos 4,5:1 nos testes de navegador; um teste estrutural impede a volta acidental dos fundos escuros legados.
10. **Uma arquitetura ativa.** Camadas antigas de enriquecimento não podem injetar painéis depois do render canônico. O resumo, a evolução e o detalhe pertencem aos renderizadores atuais de cada rota.

## Jornadas por rota

| Rota | Resposta inicial | Superfície principal | Detalhes sob demanda |
| --- | --- | --- | --- |
| Início | panorama da janela | um gráfico navegável | eventos e lacunas relevantes |
| Treinos | sessões e ritmo | ritmo semanal + sessões recentes | calendário, grupos, exercícios, máquinas e séries |
| Nutrição | cobertura diária | evolução mensal + dias recentes | refeições, distribuição, anos, candidatos e origem |
| Composição | última medição comparável | uma série selecionável | comparação, visão combinada, histórico e detalhe |
| Exames | última coleta e séries seguras | explorador longitudinal por marcador | coletas, comparação, documentos e rastreabilidade |
| Recuperação & análises | três respostas integradas | janela comum + limitações | contribuição detalhada de cada domínio |

## Evidência de conclusão

O pacote só pode ser encerrado quando testes estáticos, navegação desktop/mobile, persistência de janela, abertura dos detalhes, contraste mínimo, ausência de overflow e inspeção do build público estiverem registrados em `EXECUTION_STATE.json`.
