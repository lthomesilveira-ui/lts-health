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
- Cockpit longitudinal promovido por PR normal: composição, treino, nutrição, hidratação, exames e protocolos aparecem juntos na abertura, com acesso direto a Insights, Exames e Protocolos.
- Gráficos do cockpit exibem escalas e datas explícitas e preservam o limite de não comparar composição corporal entre origens diferentes.
- Exames estruturados existentes aparecem no cockpit com cobertura e acesso ao histórico, sem interpretação clínica automática.
- Hidratação é uma dimensão explícita e fail-closed: como a importação estruturada atual do MyFitnessPal não contém volume real de água, o app mostra a lacuna e não estima nem preenche valores.
- Conflitos no total nutricional mais recente permanecem fail-closed: quando há mais de um total para a mesma data, nenhum é escolhido automaticamente como atual.
- O `/v2/` promovido passou homologação externa automatizada em desktop/mobile; o fallback público anterior permaneceu intacto.

## Próximas prioridades

1. Recuperar hidratação somente de uma fonte real que contenha água; ampliar o importador apenas quando um formato validado trouxer esse campo, sem preenchimento por estimativa.
2. Aprofundar Exames com tendências por marcador quando existirem coletas comparáveis, preservando marcador, unidade, origem e referência e sem inventar interpretação clínica.
3. Simplificar `health-inspect-upload` para escrever evidências não canônicas diretamente em `health_source_daily_metrics`, mantendo a defesa de banco como camada secundária.
4. Continuar consolidando Apple/Polar complementar sem duplicar eventos canônicos e ampliar a camada de evidência somente quando houver mapeamento comprovado.
5. Continuar análises integradas descritivas e fortalecer a experiência de Insights sem transformar associação temporal em causalidade.
6. Ampliar Inbox, qualidade automática, rastreabilidade e preservação do backup estruturado completo.
7. Ampliar Fleury/Einstein somente a partir de originais reais e validação segura.
8. Continuar homologação visual/funcional autônoma do `/v2/` em desktop e mobile, sem usar o usuário para QA básico.
9. Manter a raiz antiga como fallback até autorização explícita de promoção.

## Bloqueios externos

- E2E web autenticado real ainda precisa ser fechado.
- HealthKit em iPhone físico ainda precisa ser testado.
- TestFlight/assinatura Apple dependem de setup externo.
- Integração direta Fleury depende de caminho autenticado/API tecnicamente e legalmente viável ainda não confirmado.
- Parsers Fleury/Einstein específicos dependem de arquivos originais reais.
