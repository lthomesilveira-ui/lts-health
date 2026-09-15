# LTS Health — remediação de iPhone físico — 15/09/2026

Checkpoint público de engenharia em andamento. Não contém dados pessoais de saúde, capturas privadas, credenciais ou material de autenticação.

## Motivo da reabertura

O proprietário forneceu oito capturas em tamanho integral da versão pública `.26` em um iPhone físico. Elas prevalecem sobre a conclusão anterior de QA e comprovam que a versão publicada não está pronta para homologação.

## Comparação direta

| Superfície | Referência aprovada | `.26` no iPhone físico | Correção candidata `.28` |
| --- | --- | --- | --- |
| Home | Hierarquia compacta com métricas, Hoje e progresso no primeiro viewport | Linha vazia da topbar oculta, componentes grandes e progresso recortado | Colapsar a linha oculta, compactar cartões e exigir progresso dentro de `393 × 650` |
| Treino | Resumo e exercícios densos, sem áreas mortas | Abas e cartões grandes; ampla faixa vazia após o último conteúdo | Reduzir escala dos componentes e remover reserva inferior duplicada |
| Composição e Exames | Detalhe progressivo com navegação discreta | Conteúdo válido, mas navegação e reserva inferior consomem altura excessiva | Compactar a navegação e aplicar um único espaço final |
| Funcionalidade | Histórico, origem e drill-down preservados | Profundidade existente continua válida | Não alterar dados, proveniência nem rotas |

## Implementação candidata

- build `physical-iphone-remediation-20260915.28`;
- autoridade visual final em `v2/physical-iphone-remediation-20260915.css`;
- gate em `393 × 852` e `393 × 650` em `v2/physical-iphone-layout-smoke.mjs`;
- Home sem a linha de `50px` da topbar oculta;
- padding inferior reduzido para um único espaço real, pois a navegação permanece em linha própria;
- densidade recalibrada em Home, Treino, Composição e Exames.

## Estado

Em execução. Este checkpoint só poderá ser fechado depois de PR/merge normal, deploy, navegação autenticada no link público, inspeção desktop e mobile e correção de qualquer defeito óbvio encontrado. A água histórica do MyFitnessPal permanece deliberadamente pendente e não bloqueia este pacote.

O build `.27` foi publicado pelo merge `e95747f` e passou no E2E autenticado real, mas foi corretamente rejeitado pelo smoke pós-deploy porque a navegação mobile media 10 px, abaixo do contrato de 10,5 px. O candidato `.28` corrige a navegação e restaura títulos internos de 25 px antes de repetir toda a promoção e inspeção pública.
