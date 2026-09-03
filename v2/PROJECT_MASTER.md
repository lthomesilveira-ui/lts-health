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
- Protocolos/tratamentos aparecem somente como contexto temporal, sem atribuição causal ou orientação de uso.
- Não declarar E2E web autenticado ou HealthKit em iPhone físico como concluído sem execução real.

## Concluído e preservado

- Arquitetura v2 por bootstrap/router → data layer → um owner por tela → componentes compartilhados → estados explícitos loading/error/empty.
- Dashboard executivo e análises longitudinais principais promovidos por PR normal.
- Limites canônicos de Apple/MyFitnessPal/treinos e separação de métricas por origem protegidos por gates.
- Inbox privado, inspetor de upload, backup estruturado e proteção contra exposição de payload bruto.
- Reconhecimento defensivo de ActivitySummary limitado às três métricas Apple autorizadas.
- Camada normalizada `health_workout_source_evidence` promovida para ligar telemetria complementar ao treino LTS sem criar uma segunda sessão.
- Topologia de fontes promovida: Polar usa evidência estruturada, `candidate/held` permanece separado e falhas parciais de proveniência não apagam o domínio que continua disponível.

## Em validação neste pacote

- Início passa a funcionar como cockpit: composição, treino, nutrição, hidratação, exames e protocolos em uma visão executiva.
- Insights, Exames e Protocolos ficam visíveis na navegação principal; Protocolos continua mostrando somente contexto temporal já registrado.
- Gráficos do cockpit passam a exibir escalas e datas explícitas e respeitam o limite de não comparar composição corporal entre origens diferentes.
- Exames estruturados existentes passam a aparecer no cockpit com cobertura e acesso direto ao histórico, sem interpretação clínica automática.
- Hidratação passa a ser uma dimensão explícita. O campo existe, mas a importação atual do MyFitnessPal não forneceu volume de água estruturado; o app mostra a lacuna e não estima valores.
- Gates desktop/mobile/compact, privacidade, proveniência e fronteiras canônicas precisam permanecer verdes antes da promoção.

## Próximas prioridades

1. Fechar e promover o pacote cockpit somente com todos os gates verdes e raiz pública anterior intacta.
2. Recuperar hidratação apenas quando houver fonte real que contenha água; ampliar o importador se um formato validado trouxer esse campo, sem preencher por estimativa.
3. Aprofundar Exames com tendências por marcador quando existirem coletas comparáveis, preservando unidade, origem e referência sem inventar interpretação.
4. Continuar consolidando Apple/Polar complementar sem duplicar eventos canônicos e ampliar a camada de evidência somente quando houver mapeamento comprovado.
5. Simplificar `health-inspect-upload` para escrever evidências não canônicas diretamente em `health_source_daily_metrics`, mantendo defesa de banco secundária.
6. Continuar análises integradas descritivas e fortalecer a experiência de Insights sem transformar associação temporal em causalidade.
7. Ampliar Inbox, qualidade automática, rastreabilidade e preservação do backup estruturado completo.
8. Ampliar Fleury/Einstein somente a partir de originais reais e validação segura.
9. Continuar homologação visual/funcional autônoma do `/v2/` em desktop e mobile, sem usar o usuário para QA básico.
10. Manter a raiz antiga como fallback até autorização explícita de promoção.

## Bloqueios externos

- E2E web autenticado real ainda precisa ser fechado.
- HealthKit em iPhone físico ainda precisa ser testado.
- TestFlight/assinatura Apple dependem de setup externo.
- Integração direta Fleury depende de caminho autenticado/API tecnicamente e legalmente viável ainda não confirmado.
- Parsers Fleury/Einstein específicos dependem de arquivos originais reais.
