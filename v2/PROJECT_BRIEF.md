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
| Composição | Histórico de medições, comparação segura entre datas e detalhe segmentar quando existir. |
| Treinos | Sessão → exercício → série, calendário, grupos trabalhados, evolução e evidência complementar. |
| Evolução | Mudanças longitudinais de composição e ritmo de treino, sem classificar o corpo como ideal ou inadequado. |
| Insights | Leitura multidomínio descritiva, cobertura por janela e caminhos para aprofundamento. |
| Protocolos | Contexto temporal de registros preservados, sem inferir situação atual, causa ou orientação de uso. |
| Timeline | Linha do tempo pesquisável e filtrável entre os domínios. |
| Exames | Coletas, marcadores, unidades, referências, método, documentos e séries comparáveis. |
| Nutrição | Totais diários, refeições, cobertura histórica e hidratação. |
| Dados | Fontes, Inbox, processamento, limitações, proveniência e backup verificável. |

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

- `EXECUTION_STATE.json`: fila operacional e bloqueios atuais.
- `CONTINUITY_PROTOCOL.md`: procedimento obrigatório para retomar o projeto sem depender do chat.
- `PROJECT_MASTER.md`: histórico de marcos e decisões técnicas.
- `PRODUCT_VISION_COCKPIT.md`: visão detalhada do cockpit.
- `REFERENCE_VISUAL_CONTRACT.md`: referência visual aprovada.
- `DATA_AUDIT.md`: regras de auditoria e reconciliação.
- `BACKUP_TRACEABILITY_CONTRACT.md`: contrato do backup verificável.
