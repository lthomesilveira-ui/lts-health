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
- Em 04/09/2026 a entrada pública principal foi promovida por PR normal ao cockpit aprovado; o deploy de `main` concluiu com sucesso e o smoke pós-deploy abriu a URL pública real, confirmou redirecionamento para `/v2/`, encontrou `Visão geral da sua saúde` e concluiu a bateria desktop/mobile sem overflow. A homologação pós-deploy também concluiu com sucesso.
- Em 04/09/2026 o cockpit recebeu um pacote adicional de fidelidade visual: cartões executivos, Leitura principal, módulos de Treino/Nutrição/Composição, Recuperação/Exames/Hidratação e fechamento Resumo/Revisões/Fontes foram refinados sem alterar semântica dos dados. O primeiro gate rejeitou apenas texto de apoio mobile abaixo do mínimo; a correção foi feita antes da promoção. O head corrigido concluiu todos os workflows disparados sem falha, o PR normal foi promovido e os smokes pós-deploy da raiz pública e homologação concluíram com sucesso em desktop/mobile. Este marco correspondeu a 8/10 da entrega visual acordada e foi posteriormente superado pelos marcos de estado real e autenticação real abaixo.
- A auditoria de estado real posterior ao marco visual detectou um caso em que séries estruturadas existiam sem os registros-pai de exercício necessários à navegação detalhada. O caso foi reconciliado exclusivamente a partir da fonte original preservada, dos identificadores estruturados já existentes e da normalização histórica; a varredura posterior de todo o histórico canônico ficou sem séries órfãs. O incidente foi registrado como item de qualidade resolvido, a cadeia treino → exercícios → séries → evidência complementar foi conferida com o mesmo proprietário RLS, e uma checagem independente confirmou que a Home usa a sessão canônica mais recente na janela e que a evidência Polar confirmada atualiza cobertura sem criar sessão duplicada. Este marco correspondeu a 9/10 e foi posteriormente superado pelo E2E autenticado real.
- Em 04/09/2026 foi executado com sucesso um E2E web autenticado real contra a aplicação pública em GitHub Pages, sem `fixture=1` e sem copiar ou armazenar senha do usuário. A automação usa identidade OIDC restrita do GitHub Actions e um token de autenticação de uso único emitido por função protegida no Supabase; credenciais privilegiadas permanecem exclusivamente no servidor. O navegador autenticou a conta real, abriu o cockpit com dados reais, validou estado de Treinos não vazio, hidratação fail-closed, expandiu a sessão estruturada mais recente e confirmou a cadeia completa de exercícios/séries, verificou histórico em Protocolos e item resolvido em Dados/Qualidade, percorreu as rotas principais em viewport mobile sem overflow e encerrou a sessão local ao final. O mesmo head concluiu os demais gates disparados sem falha. Este marco fecha o Dashboard/cockpit acordado em **10/10** sem substituir as pendências evolutivas do produto abaixo.
- O companion iOS passou a capturar `dietaryWater` real do Apple Saúde em mililitros como `dietary_water_ml`, preservado por origem e fora da promoção automática. O endpoint aceita a métrica apenas como evidência `candidate/held`; a Timeline a exibe como `Hidratação em conferência`, em mL, sem somar fontes nem tratá-la como dado confirmado. O pacote compilou com sucesso para Simulator, SDK de iPhone físico e archive não assinado; isso não substitui o gate de HealthKit em aparelho físico.
- Em 05/09/2026 a Edge Function `health-apple-sync-batch` correspondente ao pacote acima foi implantada no projeto Supabase LTS Health como versão 9, `ACTIVE`, com `verify_jwt=true`; o conteúdo implantado foi relido após o deploy e confirmou `dietary_water_ml` no conjunto preservado, mantendo a promoção canônica restrita a `active_energy_kcal`, `exercise_minutes` e `stand_hours`.
- Em 06/09/2026 a área Dados passou a expor cobertura humana de hidratação/fibra preservada por origem e recebeu correções responsivas; os gates Data Copy, Data Freshness e Confirmed Source Failure foram alinhados ao contrato atual e passaram a rodar também antes de merge. O pacote foi promovido à produção, validado em Pages/homologação e reconciliado de volta ao branch de desenvolvimento sem alterar o Dashboard aprovado.
- O backup estruturado v3 agora pode ser verificado localmente pela própria tela Dados sem enviar o JSON ao servidor. O verificador cruza escopo/completude, exclusões de privacidade, conjunto e unicidade de domínios, contagens contra as linhas reais, total de registros, `non_empty`, campos observados e hashes SHA-256 globais e por domínio. O gate desktop/mobile testa backup válido, adulteração de dados, contagens compensadas, manifesto/campos, conjunto de domínios/hashes e JSON inválido, preservando o fail-closed e as exclusões de arquivos privados, credenciais e payloads brutos.
- A Inbox de Dados separa responsabilidade do usuário de backlog operacional interno: apenas arquivos `rejected/failed` que podem exigir reenvio entram em `Sua atenção`; itens de qualidade `open/in_progress` continuam visíveis como tratamento interno do LTS Health, sem transferir revisão técnica ao usuário. Se o domínio de uploads não carregar, a Inbox fica fail-closed e não mostra falsamente que nenhuma ação é necessária. O gate Data Copy protege essa separação, a sanitização de conteúdo interno e os estados desktop/mobile.
- O E2E autenticado real deixou de depender de contagens fixas do último treino e agora deriva as expectativas do conjunto autenticado. O gate valida relações treino → exercício/série/evidência, protege a fronteira canônica das métricas complementares, cruza dinamicamente a ação exigida pela Inbox com o estado real de uploads/qualidade e preserva a navegação desktop/mobile. A execução real em 06/09/2026 concluiu com zero órfãos e zero violações da fronteira canônica. O workflow roda em mudanças do próprio contrato em `architecture-v2` e diariamente a partir de `main`, usando o bootstrap OIDC restrito; falhas transitórias de transporte têm retries limitados com timeout e falhas persistentes continuam fatais.
- Em 06/09/2026 a janela de referência de Insights passou a considerar evidência complementar preservada `candidate/held` e eventos históricos de protocolos quando forem os sinais visíveis mais recentes, mantendo evidência `rejected` fora da janela e sem promover, combinar ou comparar origens. O gate de composição do Today foi realinhado ao cockpit atual e validou em desktop/mobile que a medição mais recente continua preservada após mudança de origem, que comparações entre origens permanecem bloqueadas e que medições mais recentes ambíguas continuam fail-closed. Este avanço mantém aberta a evolução de análises integradas e priorização de cobertura.

## Pendências abertas confirmadas

1. Validar `dietary_water_ml` em iPhone físico e, somente após existir dado real e uma regra explícita de seleção de origem, decidir se pode alimentar hidratação consolidada; valores ausentes continuam ausentes e fontes diferentes não são somadas por suposição.
2. Continuar consolidando Apple/Polar complementar sem duplicar eventos canônicos e ampliar a camada de evidência somente quando houver mapeamento comprovado.
3. Continuar análises integradas descritivas, priorização de cobertura e navegação de Insights sem transformar associação temporal em causalidade.
4. Continuar ampliando qualidade automática a partir de sinais comprovados e reduzir backlog operacional interno sem transferir QA técnico ao usuário; rastreabilidade, Inbox fail-closed e backup verificável permanecem obrigatórios.
5. Ampliar Fleury/Einstein somente a partir de originais reais e validação segura.
6. Continuar homologação visual/funcional autônoma do cockpit em desktop e mobile, sem usar o usuário para QA básico.

## Feedbacks anteriores preservados / resolvidos por decisão posterior

- O feedback de 28/08 sobre a área azul/texto sem sentido na Home não deve ser reintroduzido. A referência visual canônica aprovada em 04/09 substitui aquela Home antiga por um cockpit claro, executivo, hierárquico e orientado a perguntas reais.
- O incidente de app abrir e não carregar após ajuste visual permanece como regressão obrigatória a evitar; estados loading/error/empty e smoke de navegação continuam mandatórios.
- O treino estruturado real permanece a fonte canônica; telemetria Polar/Apple não pode criar sessões duplicadas.

## Bloqueios externos

- HealthKit em iPhone físico ainda precisa ser testado, inclusive a presença e origem real de `dietaryWater`.
- TestFlight/assinatura Apple dependem de setup externo.
- Integração direta Fleury depende de caminho autenticado/API tecnicamente e legalmente viável ainda não confirmado.
- Parsers Fleury/Einstein específicos dependem de arquivos originais reais.
