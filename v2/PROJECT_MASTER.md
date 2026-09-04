# LTS Health v2 — lista-mestra de execução

Este arquivo é a referência pública de engenharia/produto para continuidade do projeto. Não contém dados pessoais de saúde, valores clínicos, credenciais ou payloads privados.

## Regras permanentes

- Em 04/09/2026 houve autorização explícita para promover o cockpit aprovado à entrada pública principal. A versão pública anterior deve permanecer preservada em `legacy.html` como fallback auditável, sem ser sobrescrita ou perdida.
- `architecture-v2` é o branch de desenvolvimento; trabalho paralelo deve ser auditado e reconciliado por merge normal, nunca por force.
- Treino estruturado LTS é o evento canônico. Apple, Polar, RingConn e outras fontes só complementam quando a proveniência permite; evidências potencialmente sobrepostas não são somadas por suposição.
- Apple só pode ser automaticamente canônico para `active_energy_kcal`, `exercise_minutes` e `stand_hours` quando a origem for ActivitySummary. Sono e demais métricas permanecem separados até regra validada.
- MyFitnessPal direto é preferencial; MyFitnessPal via Apple permanece candidato e não cria nutrição duplicada.
- `source_payload` não pode aparecer na UI nem no backup estruturado público.
- Fleury/Einstein não recebem parser específico sem documento original real e validação explícita.
- Protocolos/tratamentos aparecem somente como contexto temporal, sem atribuição causal ou orientação de uso.
- Não declarar E2E web autenticado ou HealthKit em iPhone físico como concluído sem execução real.
- Smoke/CI verde não substitui entrega visual: a entrada pública usada pelo usuário precisa efetivamente abrir o cockpit aprovado e ser validada em navegador desktop/mobile.

## Concluído e preservado

- Arquitetura v2 por bootstrap/router → data layer → um owner por tela → componentes compartilhados → estados explícitos loading/error/empty.
- Dashboard executivo e análises longitudinais principais promovidos por PR normal.
- Limites canônicos de Apple/MyFitnessPal/treinos e separação de métricas por origem protegidos por gates.
- Inbox privado, inspetor de upload, backup estruturado e proteção contra exposição de payload bruto.
- Reconhecimento defensivo de ActivitySummary limitado às três métricas Apple autorizadas.
- Camada normalizada `health_workout_source_evidence` promovida para ligar telemetria complementar ao treino LTS sem criar uma segunda sessão.
- Topologia de fontes promovida: Polar usa evidência estruturada, `candidate/held` permanece separado e falhas parciais de proveniência não apagam o domínio que continua disponível.
- Cockpit longitudinal implementado em `/v2/`: composição, treino, nutrição, hidratação, exames e protocolos aparecem juntos na abertura, com acesso direto a Insights, Exames e Protocolos.
- A Home aprovada segue `PRODUCT_VISION_COCKPIT.md`: filtro 30d/90d/1 ano/histórico; cinco domínios executivos; leitura principal; módulos analíticos de treino, nutrição e composição; segunda linha com recuperação/sono, exames e hidratação; fechamento com resumo executivo, pontos de revisão e fontes.
- Gráficos do cockpit exibem escalas e datas explícitas e preservam o limite de não comparar composição corporal entre origens diferentes.
- Exames estruturados existentes aparecem no cockpit com cobertura e acesso ao histórico, sem interpretação clínica automática.
- Explorador longitudinal de Exames promovido: marcadores com pelo menos dois pontos inequívocos da mesma origem e unidade ganham atalhos, escala vertical explícita e datas de série; origens, unidades e datas ambíguas permanecem separadas.
- Hidratação é uma dimensão explícita e fail-closed: como a importação estruturada atual do MyFitnessPal não contém volume real de água, o app mostra a lacuna e não estima nem preenche valores.
- Conflitos no total nutricional mais recente permanecem fail-closed: quando há mais de um total para a mesma data, nenhum é escolhido automaticamente como atual.
- O `health-inspect-upload` roteia sono do export Apple diretamente para `health_source_daily_metrics` como candidato, enquanto apenas as três métricas ActivitySummary autorizadas seguem para o caminho canônico; o gatilho de banco permanece como defesa secundária.
- O cockpit ganhou `Atividade & sono`: atividade diária usa somente `active_energy_kcal`, `exercise_minutes` e `stand_hours` de Apple ActivitySummary já autorizadas; sono candidato/held aparece apenas como evidência separada por origem, sem média, soma ou série consolidada entre Apple Watch, Polar ou outras fontes. Estados sem evidência permanecem explícitos e os limites são cobertos por smoke desktop/mobile e canonical-boundary.
- Dados → Detalhes por origem ganhou `Cobertura complementar preservada`: somente métricas `candidate/held` são agrupadas por origem + métrica + unidade e exibem contagem e primeira/última data. Apple Watch, iPhone, Apple Saúde/HealthKit, Polar e outras origens permanecem separadas; a visão não exibe valores brutos, não calcula médias/tendências, não combina fontes e desaparece de forma fail-closed quando `sourceMetrics` não carrega.
- Insights ganhou `Sinais complementares por origem` para passos, variabilidade da frequência cardíaca, frequência cardíaca em repouso, frequência respiratória e saturação de oxigênio. Cada série fica isolada por aparelho/origem + métrica + unidade; dias com múltiplos valores da mesma origem ficam fora da leitura, identificadores brutos não aparecem e nenhuma média ou comparação entre fontes é calculada.
- Protocolos combinam, na experiência de produto, eventos históricos e cadastros de contexto preservados. O cockpit carrega o domínio desde a abertura; a tela separa cadastro de contexto de ocorrências históricas e nunca infere situação atual ou orientação de uso.
- Insights tem resumo executivo por janela com composição, treino, nutrição/hidratação, exames, protocolos e sono, sempre descritivo, sem causalidade automática e com rotas para aprofundamento.
- Cadastros de contexto entram no backup estruturado somente com nome e proveniência segura; campos operacionais de uso e payload bruto permanecem fora da UI e do backup público.
- O gate do cockpit cobre desktop e mobile em Início, Insights e Protocolos e verifica ausência de overflow e de vazamento de conteúdo privado.
- O `/v2/` passou homologação externa automatizada em desktop/mobile.
- A versão anterior da raiz foi copiada integralmente para `legacy.html` antes da promoção pública, preservando rollback sem force ou perda de histórico.

## Pendências abertas confirmadas

1. Fechar a promoção da entrada pública principal para o cockpit aprovado com PR normal, deploy e smoke pós-deploy que valide a URL pública em desktop e mobile. A entrega só fecha quando a raiz efetivamente entrar em `/v2/` e renderizar `Visão geral da sua saúde`.
2. Fechar E2E web autenticado real com dados reais, incluindo navegação completa e ausência de zeros/estados contraditórios. O gate automatizado com fixture não substitui essa prova.
3. Recuperar hidratação somente de uma fonte real que contenha ingestão de água; ampliar o importador apenas quando um formato validado trouxer esse campo, sem estimativa.
4. Continuar consolidando Apple/Polar complementar sem duplicar eventos canônicos e ampliar a camada de evidência somente quando houver mapeamento comprovado.
5. Continuar análises integradas descritivas, priorização de cobertura e navegação de Insights sem transformar associação temporal em causalidade.
6. Ampliar Inbox, qualidade automática, rastreabilidade e preservação do backup estruturado completo.
7. Ampliar Fleury/Einstein somente a partir de originais reais e validação segura.
8. Continuar homologação visual/funcional autônoma do cockpit em desktop e mobile, sem usar o usuário para QA básico.

## Feedbacks anteriores preservados / resolvidos por decisão posterior

- O feedback de 28/08 sobre a área azul/texto sem sentido na Home não deve ser reintroduzido. A referência visual canônica aprovada em 04/09 substitui aquela Home antiga por um cockpit claro, executivo, hierárquico e orientado a perguntas reais.
- O incidente de app abrir e não carregar após ajuste visual permanece como regressão obrigatória a evitar; estados loading/error/empty e smoke de navegação continuam mandatórios.
- O treino estruturado real permanece a fonte canônica; telemetria Polar/Apple não pode criar sessões duplicadas.

## Bloqueios externos

- E2E web autenticado real ainda precisa ser fechado.
- HealthKit em iPhone físico ainda precisa ser testado.
- TestFlight/assinatura Apple dependem de setup externo.
- Integração direta Fleury depende de caminho autenticado/API tecnicamente e legalmente viável ainda não confirmado.
- Parsers Fleury/Einstein específicos dependem de arquivos originais reais.
