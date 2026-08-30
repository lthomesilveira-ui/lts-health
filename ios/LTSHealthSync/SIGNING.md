# LTS Health Sync — assinatura e gate em iPhone físico

Este documento descreve apenas o que falta entre o archive unsigned já validado em CI e um build distribuído por TestFlight. Nenhum segredo deve ser salvo no repositório.

## O que o CI sem credenciais valida

- geração do projeto por XcodeGen;
- compilação para iOS Simulator;
- compilação contra o SDK `iphoneos`;
- archive Release unsigned;
- contrato de HealthKit e de segurança do cliente;
- contrato estático de prontidão da distribuição assinada, sem acessar identidades Apple reais;
- backend autenticado com JWT;
- observers, background delivery, anchors persistidos e batches idempotentes;
- purpose string compatível com o escopo de leitura do HealthKit;
- presença dos entitlements de HealthKit e background delivery;
- uso de build number único por execução/tentativa no workflow assinado;
- ausência de material de certificado, private key ou senha no repositório.

O CI normal **não** prova que existe certificado Apple válido, provisioning profile real, App Store Connect configurado, IPA assinado ou build disponível no TestFlight. Esses itens só podem ser verificados quando o workflow manual recebe credenciais Apple reais.

## O que o workflow assinado valida quando executado

O workflow manual `.github/workflows/ios-healthkit-sign.yml`:

1. exige os secrets de assinatura antes de qualquer archive;
2. importa o certificado e confirma uma identidade `Apple Distribution` utilizável;
3. decodifica o provisioning profile e confere App ID explícito, Team ID, HealthKit e background delivery;
4. rejeita profile com wildcard, lista de devices, `get-task-allow`, distribuição enterprise ou data expirada;
5. exige, portanto, um provisioning profile App Store Connect compatível, sem lista de aparelhos registrados e não expirado;
6. gera um build number único por execução/tentativa usando `GITHUB_RUN_NUMBER.GITHUB_RUN_ATTEMPT`;
7. faz archive e export com assinatura manual explícita;
8. valida o IPA assinado antes de publicá-lo como artefato, conferindo bundle id, build number, assinatura, entitlements e profile embarcado;
9. quando TestFlight for solicitado, valida o pacote no App Store Connect antes do upload;
10. remove material temporário de assinatura ao final do job, inclusive em caso de falha.

O workflow continua `workflow_dispatch` only: assinatura e TestFlight nunca são disparados automaticamente por push.

## Pré-requisitos externos para assinatura

Antes da primeira execução assinada são necessários:

- associação ativa ao Apple Developer Program;
- App ID explícito `com.ltshealth.sync` com as capabilities HealthKit e background delivery habilitadas;
- certificado Apple Distribution válido;
- provisioning profile App Store Connect compatível com esse App ID e certificado;
- registro do app no App Store Connect para uso de TestFlight;
- material abaixo armazenado apenas em GitHub Actions secrets.

### Secrets para gerar IPA assinado

- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64`

### Secrets adicionais para TestFlight

- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY_BASE64`

Esses valores não devem aparecer em commits, issues, logs ou mensagens públicas.

## Como interpretar o artefato assinado

O `.ipa` gerado pelo workflow usa distribuição `app-store-connect`. Ele comprova que archive, assinatura, entitlements e provisioning profile são coerentes, mas o arquivo do artefato **não é tratado como um pacote para sideload direto** no iPhone.

**TestFlight é o caminho de instalação previsto** para o gate real deste projeto. Para chegar ao aparelho físico, o workflow deve ser executado com `upload_testflight=true`, o build deve ser aceito pelo App Store Connect e disponibilizado ao tester autorizado.

## Gate em aparelho físico

Depois de uma build aceita e disponível no TestFlight:

1. instalar `LTS Health Sync` pelo TestFlight no iPhone;
2. entrar com a mesma conta LTS Health;
3. tocar em `Conectar Apple Saúde`;
4. conceder somente as permissões solicitadas pelo app;
5. executar a sincronização inicial;
6. confirmar no LTS Health que os dias esperados aparecem sem duplicação;
7. gerar uma nova alteração de atividade no Apple Saúde e deixar o app fora de primeiro plano;
8. confirmar posteriormente que o backend recebeu a atualização por background delivery;
9. testar logout/login e renovação de sessão;
10. confirmar que nenhuma métrica fora do escopo canônico v1 foi promovida automaticamente.

Só depois desse gate é permitido declarar a sincronização HealthKit em background como validada em aparelho físico.

## Regra de segurança

Nunca converter o archive unsigned em uma build assinada com certificado ou profile armazenado no repositório. O pipeline assinado é manual-only e usa exclusivamente GitHub Actions secrets.
