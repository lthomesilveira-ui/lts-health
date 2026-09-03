# LTS Health v2 — lista-mestra de execução

Este arquivo é a referência pública de engenharia/produto para continuidade do projeto. Não contém dados pessoais de saúde, valores clínicos, credenciais ou payloads privados.

## Regras permanentes

- A raiz pública anterior permanece fallback e não é promovida/substituída sem autorização explícita.
- `architecture-v2` é o branch de desenvolvimento; trabalho paralelo deve ser auditado e reconciliado por merge normal, nunca por force.
- Treino estruturado LTS é o evento canônico. Apple, Polar, RingConn e outras fontes só complementam quando a proveniência permite; evidências potencialmente sobrepostas não são somadas por suposição.
- Apple só pode ser automaticamente canônico para `active_energy_kcal`, `exercise_minutes` e `stand_hours` quando a origem for ActivitySummary. Sono e demais métricas permanecem separados até regra validada.
- MyFitnessPal direto é preferencial; MyFitnessPal via Apple permanece candidato e não cria nutrição duplicada.
- `source_payload` não pode aparecer na UI nem no backup estruturado público.
- Fleury/Einstein não recebem parser específico sem documento original real e validação explícita.
- Tratamentos aparecem somente como contexto temporal, sem atribuição causal.
- Não declarar E2E web autenticado ou HealthKit em iPhone físico como concluído sem execução real.

## Concluído e preservado

- Arquitetura v2 por bootstrap/router → data layer → um owner por tela → componentes compartilhados → estados explícitos loading/error/empty.
- Dashboard executivo e análises longitudinais principais promovidos por PR normal.
- Limites canônicos de Apple/MyFitnessPal/treinos e separação de métricas por origem protegidos por gates.
- Inbox privado, inspetor de upload, backup estruturado e proteção contra exposição de payload bruto.
- Reconhecimento defensivo de ActivitySummary por `source_payload.method` limitado às três métricas Apple autorizadas, promovido por PR normal.
- Camada normalizada `health_workout_source_evidence` implementada neste pacote para ligar telemetria complementar ao treino LTS sem criar uma segunda sessão. Backfill somente quando a proveniência registrada cita a fonte explicitamente; telemetria histórica sem origem comprovada permanece sem atribuição.

## Em validação neste pacote

- Gate dedicado de evidência complementar de treino: vínculo somente com treino canônico visível, evidência candidata não vira fonte confirmada, backup preserva evidência estruturada sem decoração de UI e sem `source_payload`.
- CI completo do `architecture-v2` e smoke do candidato após o commit.

## Próximas prioridades

1. Consolidar Polar/Apple complementar sem duplicar eventos canônicos e ampliar a camada de evidência somente quando houver mapeamento comprovado.
2. Revisar registros LTS com telemetria histórica sem proveniência explícita; manter origem desconhecida até existir evidência real, sem retroatribuição por suposição.
3. Simplificar futuramente `health-inspect-upload` para escrever evidências não canônicas diretamente em `health_source_daily_metrics`, mantendo trigger de banco como defesa secundária.
4. Continuar análises integradas descritivas: composição × consistência de treino; composição segmentar × grupos treinados; nutrição × períodos; performance apenas com exercício/máquina/unidade comparáveis; sono × performance apenas com dado confirmado e sem sobreposição; exames ao longo do tempo quando houver múltiplas coletas.
5. Ampliar importação/Inbox, qualidade automática, rastreabilidade e preservação do backup estruturado completo.
6. Ampliar Fleury/Einstein somente a partir de originais reais; manter investigação de caminho autenticado Fleury sem prometer API inexistente.
7. Continuar homologação visual/funcional autônoma do `/v2/` em desktop e mobile, sem usar o usuário para QA básico.
8. Preservar a candidata em paralelo e manter a raiz antiga como fallback até autorização explícita de promoção.

## Bloqueios externos

- E2E web autenticado real ainda precisa ser fechado.
- HealthKit em iPhone físico ainda precisa ser testado.
- TestFlight/assinatura Apple dependem de setup externo.
- Integração direta Fleury depende de caminho autenticado/API tecnicamente e legalmente viável ainda não confirmado.
- Parsers Fleury/Einstein específicos dependem de arquivos originais reais.
