# Estados de conexão e arquivos — publicada .131

## Problema e comportamento

A presença de variáveis de configuração fazia o cartão Google Health dizer “Pronta para conectar”, embora não comprovasse que a credencial funcionava. O cartão agora distingue “Conta não conectada”, “Conta autorizada” e “Integração indisponível” e explica que autorizar a conta não comprova recebimento de água. Não promete preparação em andamento.

A área Seus arquivos dizia “Nenhuma ação sua é necessária” a partir apenas da ausência de uploads com falha. A mensagem agora se limita a “Nenhum arquivo precisa ser reenviado”. O indicador e a contagem também se referem somente a reenvio de arquivos. Integrações, observações e registros adicionais mantêm seus estados próprios.

## Limites

A alteração é apenas de apresentação. Requests, escopos, controles de acesso, credenciais, criptografia, rotinas, dados de saúde, fontes e status persistidos permanecem intactos. Nenhuma conexão, água recente, recorrência, histórico legado ou aceite físico é declarado concluído por estas mensagens.

## Validação

Contratos locais existentes verificam dono ausente, conta não configurada, configuração sem conta, conta autorizada sem leitura, retorno de autorização, isolamento de sessão, ausência de novas operações de credencial e janela civil de consulta. O diagnóstico de arquivos verifica estado vazio com integração incompleta, erros de consulta, falhas reais e preservação de registros. Paridade entre produção e prévia, integridade do grafo e proteção de conteúdo público passam. As 21 verificações da candidata corrigida passaram; publicação e checagem autenticada foram concluídas.

A primeira candidata 9e8b975 teve três workflows interrompidos no mesmo gate estático: o inventário de hashes da prévia ainda descrevia os módulos anteriores. O inventário foi alinhado aos dois arquivos alterados e ao novo identificador de build, sem remover nenhuma validação. Os resultados iniciais foram preservados; a candidata corrigida exige os gates completos.

## Publicação comprovada

- PR520: candidata 791088c7209166bad646ce39c923c7889a63f62c,21/21 workflows; merge normal dfcf1bba3326a53625467ec1a96b680472fd5746 mantém a árvore 0673f250f36c9f0facd78fda8c80126924302dcd.
- PR521: candidata de verificação b0b847b46cd29cd91eac5f1db9ace704aa53d083,14/14; merge normal dde3b1a009fdb1cba4498562ec3d8c752b90d873 mantém a árvore 0698cb70cd22ea87ac798844e2844d231d3c955e. Somente o verificador muda: todas as mensagens Google são comparadas à leitura autenticada independente e a proibição de ações sem configuração permanece.
- Deploy 43133094588 e Real Auth 43133094623 passam. A conferência autenticada percorre históricos completos, desktop/celular e evidência visual privada cifrada. A conferência anterior 43132403053 também passou.
- Cloud Browser confirma build health-integrated-20261112.131 e a proteção de entrada. Os componentes reais, com dados fictícios e zero gravações, exibem os estados específicos e o detalhe de arquivos em 390px sem rolagem horizontal. Essa validação não substitui aceite em iPhone físico.
- Hashes SHA256 publicados iguais à candidata: index7291d0b393ec03daf5379d9fb790fa464bf57999f9d496fc30a20f00185dc3cf; Googlef4045737842e1d21eba433afc147633ffd3db5ebf088458badd40fac0013dd76; arquivos221e9836548ecdfc3c4526e4bce5bc89dbb55bf5f8ae9716aa0f32933b405071.

As duas correções de apresentação não encerram nenhuma das dez condições originais de fonte, água, histórico, integração ou aceite físico. Os resultados das repetições automáticas posteriores ao merge ficam registrados no resumo CI de EXECUTION_STATE.json; não equivalem a dados novos ou a aceite global do aplicativo.

A repetição pós-merge43133094766, tentativa1/job130901761435, encontrou timeout de30s no cenário sintético WebKit1440 de saída e retorno ao envio de arquivo, esperando uploadForm após o clique de navegação. A candidata de runtime, a candidata de verificação e a repetição anterior dessa árvore pública passaram. Apenas o job que falhou foi repetido uma vez, no mesmo código; nenhuma asserção foi removida. A tentativa 2/job 130903982669 passou no mesmo código, mantendo a primeira falha registrada. As 19 verificações pós-merge foram concluídas com sucesso.
