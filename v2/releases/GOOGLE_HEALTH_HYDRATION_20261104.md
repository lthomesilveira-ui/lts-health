# Preparação da leitura oficial de hidratação — 04/11/2026

A água atribuída ao MyFitnessPal no Google Health ainda não tem transferência recente comprovada ao LTS pela ponte existente. Este pacote prepara uma alternativa oficial de leitura, com autorização própria e preservação da origem. O aplicativo público continua `health-integrated-20261102.122`. A preparação não encerra os nove critérios independentes da fila.

## Comportamento implementado

- OAuth de servidor com PKCE S256, estado aleatório de uso único e validade de dez minutos; uma nova autorização invalida a anterior.
- Somente `https://www.googleapis.com/auth/googlehealth.nutrition.readonly`. Nenhum escopo de escrita é solicitado.
- Verificação de `users/me/identity` e `healthUserId` antes de concluir a conexão; mudança de perfil é rejeitada.
- Tokens e verificador criptografados por AES-GCM com chave própria, vinculados ao usuário e à finalidade; nenhum token ou dado bruto aparece no status HTTP.
- Consulta `hydration-log` com datas civis explícitas, limite de31dias, família `users/me/dataSourceFamilies/all-sources`, paginação completa e limites de tempo, páginas, registros e bytes.
- Identidade estável, intervalo, offset, unidade e origem brutos preservados. A API já retorna o volume em mililitros; unidade de exibição não provoca segunda conversão.
- Ausência válida, resposta incompleta, fonte desconhecida e volume inválido permanecem distintos. Nada é convertido em zero por falta de informação.
- Resultados completos são guardados atomicamente em snapshots privados. Repetição idêntica não cria outro snapshot; alterações reais conservam a observação anterior.
- Nenhum resultado é elegível automaticamente para água canônica. A leitura não presume que origens diferentes sejam MyFitnessPal ou cópias do mesmo evento.

## Publicação e evidência

A migration nativa `20261104233826 / prepare_google_health_hydration_read` foi aplicada. A migration versionada foi originalmente gerada pelo CLI; o identificador aplicado pelo serviço é registrado aqui sem editar a história do banco. O esquema é reaplicável e usa um slot de autorização por usuário, consumido por atualização atômica. Não há instrução DELETE.

As tabelas `health_google_connections`, `health_google_oauth_states` e `health_google_hydration_reads` têm RLS e nenhum privilégio de navegador. As cinco operações são SECURITY INVOKER, com search_path vazio e execução restrita ao servidor. O histórico de leituras tem somente SELECT/INSERT para service_role. A releitura em produção confirmou zero conexões, estados e leituras, sem criar dados fictícios na conta real.

| Rota publicada | Versão | Autenticação | SHA256 do bundle |
| --- | --- | --- | --- |
| health-google-connection | 1 | JWT e usuário verificado, não anônimo | 8f5c8c0c058b62426084975675301946cd3dbf6d6cec4f822f8f314365739ccd |
| health-google-callback | 1 | Estado aleatório de uso único, conta e geração vinculados | 08d677de338242ddab35dd8eb550397e2e1946a745ae60fe8cf13122409518ca |

Os cinco arquivos de cada rota foram comparados com os arquivos testados. A conexão sem autenticação responde401; o callback desativado responde409/`configuration_required`. O callback não usa JWT do aplicativo porque é o retorno de redirecionamento do Google; autentica o estado privado antes da troca de código e gravação.

Passaram53 testes Node e11 testes em PostgreSQL17.11 real descartável. São cobertos HTTP, paginação parcial, PKCE, expiração, replay, troca de conta, concorrência, desconexão durante operação, revogação dos privilégios padrão, isolamento, rollback, idempotência e preservação dos registros existentes. A falha intermediária de fixture que repetia o mesmo hash em duas contas permanece no histórico; a correção usa identidades distintas e testa a colisão como transação rejeitada.

A validação genuína protegida Real Auth41936831636/job126947292540 passou após a publicação: lê apenas status e testa rejeições, sem criar consentimento Google ou leitura real. PR498 candidata d8579bb87f80996e844d83ffcd002cb83d879e48 passou22/22; o merge normal eee4d2eff43bd5328d812e1399f47be1642e3bbd preserva exatamente a árvore2c0729710e77140ddfc1afc1f24cf26c5369cec0.

O pós-merge original conserva26sucessos e uma verificação cancelada duas vezes durante os downloads de dependências Ubuntu, antes de iniciar testes de navegador. PR499 corrige somente o ambiente para a imagem oficial Playwright1.56.1-noble, com a mesma versão de pacote, testes, asserções, limite e artefatos. Sua candidata5830f8303e999a3d9e74b8e2b5206da2af3a2113 passou7/7 e todos os passos de navegador; merge normal86143c6e3ebec637f8adaff3c459f7ecf1229c52 preserva a árvorea870ffcac4409285b4bfab0164ee639bf8bc2b84. As interrupções anteriores permanecem registradas; não são somadas como sucesso. A preparação interna está entregue, sem encerrar os nove bloqueios originais.

## Ativação externa ainda pendente

Não há projeto OAuth, cliente, segredo ou consentimento configurados. O servidor permanece desativado. A rota oficial chegou à tela de login Google. O pedido seguro de acesso e as verificações posteriores não retornaram resultado nesta sessão, inclusive em página nova. A autenticação permanece desconhecida; não há evidência de recusa ou bloqueio de bot. Retomar pelo acesso oficial quando estiver respondendo, sem repetir pedidos de credencial ou usar caminhos indiretos.

Depois do acesso, configurar um cliente web de servidor com retorno exato:
`https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-google-callback`.

Os valores `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET` e uma chave Base64 própria de32bytes em `GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY` ficam somente no servidor. `GOOGLE_HEALTH_ENABLED=true` é necessário adicionalmente. Não colocar valores em chat, repositório, captura ou documentação. O consentimento Google é uma ação distinta do login. Em modo Testing, o refresh token pode expirar em sete dias; recorrência permanente não está comprovada.

Após consentimento, verificar o perfil e uma janela com registros existentes, conservar a resposta original em armazenamento privado, resolver a identidade da fonte e sobreposições por evidência independente, e comprovar outra atualização automática posterior. Nenhum lançamento manual, consumo de teste, exportação recorrente ou repetição do setup do telefone substitui essa prova.

## Referências primárias

- [Configuração oficial](https://developers.google.com/health/setup)
- [dataPoints.list e família de fontes](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list)
- [Identidade do perfil](https://developers.google.com/health/reference/rest/v4/users/getIdentity)
- [Tipos de dados de nutrição](https://developers.google.com/health/data-types/nutrition)

A troca do ambiente de teste segue a [documentação oficial de Docker do Playwright](https://playwright.dev/docs/docker): o pacote continua instalado na versão correspondente à imagem com os navegadores e bibliotecas preparados. A interface e os testes não foram modificados pela correção do runner.
