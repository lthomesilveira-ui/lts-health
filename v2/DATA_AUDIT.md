# LTS Health v2 — auditoria de dados

Snapshot auditado em 2026-08-28 no projeto Supabase dedicado do LTS Health. Este documento registra apenas contagens, intervalos e regras de consolidação; não inclui payloads privados nem valores clínicos individuais.

## Cobertura por domínio

| Domínio | Registros | Intervalo observado |
| --- | ---: | --- |
| Composição corporal | 35 | 2024-08-30 → 2026-08-24 |
| Composição segmentar | 4 | 2026-03-20 → 2026-08-24 |
| Treinos | 44 | 2026-04-28 → 2026-08-27 |
| Exercícios estruturados | 69 | 2026-08-03 → 2026-08-27 |
| Séries estruturadas | 162 | 2026-08-03 → 2026-08-27 |
| Resultados laboratoriais | 33 | 2026-02-26 |
| Documentos de saúde | 23 | 2025-08-28 → 2026-08-25 |
| Nutrição diária | 2.289 | 2018-06-04 → 2026-08-26 |
| Refeições | 4.901 | 2018-06-04 → 2026-08-26 |
| Atividade | 3.794 | 2018-06-04 → 2026-08-26 |
| Métricas gerais | 1.096 | 2018-06-04 → 2026-07-16 |
| Uploads | 1 | 2026-08-27 |
| Questões de qualidade | 26 | 2026-08-25 → 2026-08-28 |
| Eventos de tratamentos | 30 | 2026-07-03 → 2026-08-28 |
| Regimes de tratamento preservados | 6 | snapshot de 2026-08-26 |

Questões de qualidade no snapshot: 17 abertas, 4 aceitas e 5 resolvidas.

## Reconciliação dos treinos recentes

Os três treinos recentes presentes no contexto do projeto foram conferidos contra `health_workouts`, `health_workout_exercises` e `health_workout_sets`.

- Todos permanecem `validated` e incluídos no histórico principal.
- Contagens estruturadas conferem com o contexto do projeto: 8 exercícios/33 séries; 8/28; 7/25.
- Zero séries sem repetição registrada.
- Zero séries sem `source_record_id`.
- Zero `source_record_id` duplicado em `health_workout_sets`.
- Nenhum campo foi criado ou completado por inferência nesta auditoria.

## Regras de sobreposição e deduplicação

1. **Treino estruturado do LTS Health é a sessão principal.** Apple Health, Polar ou MyFitnessPal não criam uma segunda sessão quando representam o mesmo treino já registrado.
2. **Apple Health é o hub passivo preferido para métricas validadas**, desde que o parser tenha uma regra explícita e não haja ambiguidade de múltiplas fontes para o mesmo dia/métrica.
3. **Polar pode coexistir como evidência complementar** quando trouxer detalhe que o Apple Health não preserva, por exemplo duração/FC detalhada da sessão. Isso não autoriza somar calorias, duração ou outro valor ao registro principal.
4. **MyFitnessPal descreve nutrição e atividade exportada, mas não substitui o treino estruturado.** Atividade do MFP não é contada como nova sessão se houver correspondência com um treino principal.
5. **Nenhum valor de múltiplas fontes é agregado automaticamente.** Quando duas fontes registrarem a mesma métrica/dia, o dado deve ser marcado para revisão ou resolvido por regra determinística específica antes de entrar em totais.
6. **Ausência de registro não significa zero.** Telas devem mostrar ausência de dado de forma explícita.
7. **Unidades incompatíveis nunca são convertidas por suposição.** Progressão de exercício só compara cargas com unidade explicitamente compatível.

No snapshot auditado, há zero combinação dia + tipo de métrica com múltiplas fontes em `health_metrics`.

## Gate para a nova interface

A arquitetura v2 deve usar estas tabelas como fonte única e produzir contagens derivadas diretamente das coleções carregadas. Nenhuma tela pode manter um número fixo de referência para decidir se há ou não dados. Se uma consulta falhar, a tela deve mostrar erro/indisponibilidade; não deve renderizar `0` como substituto.
