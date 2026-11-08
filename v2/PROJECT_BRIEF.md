## 2026-11-07 — Em execução: data da atualização Polar em São Paulo, .128

A sessão real da .127 mostrava 08/11 na última atualização Polar e 07/11, 21:17:05 no horário automático de São Paulo. O pacote046/LTS-POLAR-UPDATE-DATE-001 converte apenas a apresentação desse instante para o dia civil de São Paulo. O horário original, os dados de saúde, a autorização e a agenda permanecem preservados. O renderizador real passou expectativas independentes de meia-noite, ano, bissexto, offset explícito e entrada inválida; faltam os gates da candidata e a conferência publicada.

Os conflitos documentais da PR510 foram resolvidos preservando integralmente o registro verificado do pacote045 em main e acrescentando apenas a nova tarefa046. As duas correções .127 estão entregues; a terceira ainda não está encerrada. Fila127done,1in_progress,9blocked_external,2accepted_gap,2superseded. As nove condições originais permanecem independentes, e as mensagens de continuar Health/Wealth seguem desativadas. Detalhes: v2/releases/POLAR_LOCAL_UPDATE_DATE_20261108.md.

## 2026-11-07 — Concluído: consulta inclui hoje e retorno da conexão, .127

O pacote045 encerrou duas falhas de funcionamento: a consulta manual agora inclui hoje nos30dias civis de São Paulo; uma autorização Google inválida ou expirada oferece uma mensagem em português e Voltar ao Health. A sessão autenticada existente foi restaurada pelo retorno público real, na versão exata. Água real, origem e recorrência continuam com critérios próprios.

PR509: candidata5f4ab5910be121262a77a00576324b4f67208c9e, árvore74a710823a96fad6dcf430a71c016f8c2cc1a68c,21/21 verificações aprovadas. Merge normaldf88ad4f86c1fe133c20bf3bbafd4344ac42c488 preservou a árvore. Deploy, duas entradas Pages, acesso real protegido e leitor Google passaram. Página e módulos públicos foram comparados antes da ativação; callback6/conexão7/agenda2 tiveram6/6/7arquivos relidos sem diferenças, mantendoJWTfalse/true/false. As repetições gerais de publicação ainda em curso estão enumeradas no EXECUTION_STATE.json e não são contadas como sucesso.

Fila127done,9blocked_external,2accepted_gap,2superseded; zero ready/in_progress. Nenhuma das nove condições originais foi encerrada por estas correções. A conta Google ainda não está conectada, nenhuma leitura real foi recebida, e a água disponível continua até13/10. O loginDECLINED não foi repetido; as mensagens agendadas de continuar permanecem desativadas. Detalhes: v2/releases/GOOGLE_CONNECTION_RECOVERY_20261107.md.

## 2026-11-07 — Em execução: água de hoje e retorno da autorização, .127

O pacote045 corrige duas falhas concretas. A consulta manual anunciava os últimos30dias, mas usava hoje como limite exclusivo e descartava os registros do próprio dia. O retorno de autorização inválida/expirada mostrava JSON técnico sem caminho de volta ao Health. A candidata usa amanhã como limite exclusivo e uma página fixa em português para o retorno de falhas no navegador; as respostas JSON e o retorno de sucesso conservam o contrato.

Os testes locais validaram calendário BRT, viradas de ano/dia, ano bissexto, um registro sintético de hoje no leitor real e limites de privacidade/replay/autorização. A página não recebe estado, código, identidade nem texto arbitrário do provedor. Gates de navegador, publicação e conferência autenticada continuam pendentes. Não há nova conexão ou água real comprovada, nem alteração clínica. As nove condições originais permanecem independentes. As duas rotinas de mensagens de continuar seguem desativadas por decisão posterior do titular. Detalhes: v2/releases/GOOGLE_CONNECTION_RECOVERY_20261107.md.

## 2026-11-07 — Agenda horária Google entregue; conexão real ainda pendente

O pacote 044 / LTS-GOOGLE-BACKGROUND-001 está concluído. A rotina privada consulta as contas Google já autorizadas a cada hora, sem abrir o app. O leitor mantém identidade, origem, janela civil de 30 dias em São Paulo e proteção contra leituras simultâneas. Os registros recebidos ficam privados para conferência antes de qualquer inclusão nos totais de água.

PR508: candidata 923658170da615fe42ab115be3f3de61911fdb1e e árvore ce811ba85e33f01c0792833cef8fe2f0e0ce398e passaram 17/17 workflows, 71 testes Node e 24 PostgreSQL 17.11. Merge normal feadc8c180d8e4971bfd6485015ed615267e0bca preservou a árvore; 21/21 verificações de publicação passaram. Migration nativa 20261107223447, permissões e arquivos das três rotas publicados foram conferidos. A agenda está ativa em intervalo de 60 minutos. Um despacho real com a lista de contas autorizadas vazia respondeu 200; o ticket foi consumido, apagado após o uso e recusado na repetição.

A sessão genuína do aplicativo .126 foi atualizada e mostrou Google Health pronta para conectar. A recusa 403 anterior continua sem causa técnica comprovada; testador e retorno já cadastrados não demonstram autorização concluída. Não repetir configuração administrativa ou trocar credenciais. Consentimento, leitura real, origem e recorrência posterior têm aceites próprios. As nove dependências originais continuam abertas; 125 tarefas concluídas, 9 bloqueadas por dependência externa, 2 lacunas aceitas e 2 alternativas substituídas; zero ready/in_progress. O frontend permanece .126. Detalhes: v2/releases/GOOGLE_HEALTH_BACKGROUND_20261107.md.

# LTS Health — briefing consolidado do produto

Este documento consolida as decisões de produto recuperadas do histórico, dos arquivos de passagem, do código, do banco e das homologações. Ele é público e, por isso, registra regras e expectativas sem dados pessoais de saúde, credenciais ou payloads privados.

## Resultado esperado

O LTS Health deve ser um cockpit longitudinal privado que transforme fontes fragmentadas em uma leitura coerente, navegável e auditável. A abertura responde primeiro **o que está registrado, como evoluiu e onde falta cobertura**; o detalhe vem depois.

Não é um repositório de cartões independentes, uma planilha de arquivos ou um sistema que exige do usuário revisão técnica linha por linha. A experiência segue a progressão:

1. resumo executivo;
2. evolução no tempo;
3. detalhe do registro e sua origem.

## Escopo funcional

| Área | Papel no produto |
| --- | --- |
| Início | Cockpit executivo com composição, treinos, nutrição/hidratação, recuperação e exames. |
| Timeline | Linha do tempo pesquisável e filtrável entre os domínios. |
| Composição | Histórico de medições, comparação segura entre datas e detalhe segmentar quando existir. |
| Treinos | Sessão → exercício → série, calendário, grupos trabalhados, evolução e evidência complementar. |
| Recuperação e análises | Leitura multidomínio descritiva, sono por origem, cobertura por janela e caminhos para aprofundamento. |
| Protocolos | Contexto temporal de registros preservados, sem inferir situação atual, causa ou orientação de uso. |
| Exames | Coletas, marcadores, unidades, referências, método, documentos e séries comparáveis. |
| Nutrição | Totais diários, refeições, cobertura histórica e hidratação. |
| Dados | Fontes, Inbox, processamento, limitações, proveniência e backup verificável. |

`Evolução` permanece como rota de compatibilidade, mas suas capacidades pertencem a Composição e Treinos e não concorrem na navegação principal.

## Fontes que o produto precisa reconciliar

- Registros estruturados do próprio LTS Health.
- MyFitnessPal direto para nutrição, atividade exportada, peso e água quando houver evidência própria.
- Apple Saúde/HealthKit, Apple Watch e iPhone como fontes identificadas, nunca como um bloco indistinto.
- Polar e outros dispositivos como evidência complementar quando o vínculo ao evento estiver comprovado.
- Bioimpedância/InBody para composição corporal e segmentar.
- Fleury, Einstein e outros laboratórios a partir de resultados ou documentos originais reais.
- Documentos e inventários históricos, distinguindo metadado de arquivo original disponível.

## Contrato de confiança dos dados

1. **Fidelidade máxima:** valor ausente continua ausente; não preencher lacunas por estimativa.
2. **Proveniência visível:** manter origem, data, unidade, arquivo e confiança quando existirem.
3. **Fail-closed:** falha de consulta ou ambiguidade aparece como indisponível/em revisão, nunca como zero.
4. **Sem duplicação:** fontes que observam o mesmo evento não criam automaticamente dois eventos canônicos.
5. **Sem soma entre fontes:** sono, hidratação, passos ou outras séries sobrepostas permanecem separadas até existir regra determinística validada.
6. **Unidades preservadas:** cargas em kg, lb, índice de placa ou sem unidade não são comparadas como equivalentes.
7. **Fonte original preservada:** texto bruto e arquivo continuam disponíveis quando a estruturação segura for parcial.
8. **Sem causalidade automática:** proximidade entre treino, alimentação, sono, exame ou protocolo não prova relação causal.

## Regras canônicas por origem

- O treino estruturado do LTS é a sessão principal. Polar/Apple podem complementar telemetria comprovada sem criar outra sessão.
- Apple ActivitySummary só entra automaticamente como canônico para energia ativa, minutos de exercício e horas em pé. As demais métricas permanecem por origem até validação.
- MyFitnessPal direto tem precedência sobre totais recebidos indiretamente pelo Apple Saúde. Candidatos indiretos não criam refeições ou horários.
- Peso de composição corporal prevalece na mesma data; outra fonte pode preencher datas sem medição de composição, mantendo a origem.
- Água ingerida e água corporal são conceitos diferentes e nunca se substituem.
- Tendência laboratorial exige marcador, origem e unidade compatíveis; texto ambíguo não vira número.
- Protocolos são contexto histórico, nunca prescrição ou explicação causal.

## Hidratação e MyFitnessPal

O caminho histórico comprovado usa uma sessão autenticada do MyFitnessPal no navegador:

1. o extrator percorre o período automaticamente e mantém checkpoint para retomada;
2. somente datas e totais positivos em mL entram no JSON;
3. o LTS valida esquema, período, cobertura, contagens, duplicidades e valores antes da gravação;
4. a importação é idempotente por data e não altera refeições ou outros dados;
5. senha, cookies, perfil e o JSON original não são enviados ao LTS.

O formulário manual existe apenas para corrigir uma data isolada. Ele não é a estratégia para recuperar o histórico.

## Experiência e linguagem visual

- Canvas principal claro, navegação lateral escura no desktop e navegação móvel sem cobrir conteúdo.
- Alta densidade informativa com hierarquia, sem aparência de planilha ou painel genérico.
- Cinco cartões executivos e módulos analíticos organizados conforme `REFERENCE_VISUAL_CONTRACT.md`.
- Filtros de 30 dias, 90 dias, 1 ano e histórico; composição e exames esparsos continuam mostrando o último registro conhecido fora de janelas curtas.
- Gráficos só entram quando respondem a uma pergunta real e precisam mostrar datas, unidade e escala legíveis.
- Texto da interface deve falar em termos do usuário; códigos internos, payloads, status de parser e detalhes operacionais não aparecem.

## Privacidade e segurança

- Aplicação autenticada e dados privados protegidos por proprietário/RLS.
- Arquivos originais ficam em armazenamento privado.
- Credenciais, tokens, `storage_path` e `source_payload` ficam fora da interface e do backup estruturado.
- Documentação e testes públicos não contêm valores, datas ou contagens pessoais.
- Operações privilegiadas permanecem no servidor; o navegador recebe somente o acesso mínimo necessário.

## Definição de pronto

Uma entrega só está concluída quando:

- o comportamento tem critério de aceite verificável;
- contratos unitários/estáticos e browser gates desktop/mobile passam;
- falhas parciais continuam fail-closed;
- não há regressão de privacidade, proveniência, navegação ou responsividade;
- quando aplicável, o estado autenticado real e o deploy público são verificados;
- a evidência e o estado da pendência são atualizados em `EXECUTION_STATE.json`.

## Fora de escopo

- Diagnóstico, prescrição, recomendação clínica ou atribuição causal automática.
- Metas corporais, julgamentos estéticos ou classificação de valores como bons/ruins sem contexto profissional apropriado.
- Inventar dados para completar gráficos, médias ou séries.
- Compartilhar senha ou reutilizar sessão autenticada fora do navegador do usuário.

## Documentos complementares

- `PRODUCT_ARCHITECTURE.md`: tese, arquitetura de informação, hierarquia e contrato das jornadas.
- `FEEDBACK_LEDGER.md`: feedbacks e dívidas com IDs estáveis, estado e evidência.
- `EXECUTION_STATE.json`: fila operacional e bloqueios atuais.
- `CONTINUITY_PROTOCOL.md`: procedimento obrigatório para retomar o projeto sem depender do chat.
- `PROJECT_MASTER.md`: histórico de marcos e decisões técnicas.
- `PRODUCT_VISION_COCKPIT.md`: visão detalhada do cockpit.
- `REFERENCE_VISUAL_CONTRACT.md`: referência visual aprovada.
- `DATA_AUDIT.md`: regras de auditoria e reconciliação.
- `BACKUP_TRACEABILITY_CONTRACT.md`: contrato do backup verificável.
