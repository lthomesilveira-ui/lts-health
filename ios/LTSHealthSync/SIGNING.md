# LTS Health Sync — assinatura e gate em iPhone físico

Este documento descreve apenas o que falta entre o archive unsigned já validado em CI e um build instalável/TestFlight. Nenhum segredo deve ser salvo no repositório.

## O que já é validado automaticamente

- geração do projeto por XcodeGen;
- compilação para iOS Simulator;
- compilação contra o SDK `iphoneos`;
- archive Release unsigned;
- contrato de HealthKit e de segurança do cliente;
- backend autenticado com JWT;
- observers, background delivery, anchors persistidos e batches idempotentes.

## O que exige identidade Apple real

A assinatura do app e a instalação em um iPhone físico exigem uma identidade válida do Apple Developer Program e um provisioning profile compatível com o bundle id `com.ltshealth.sync` e com a capability HealthKit.

O workflow manual `.github/workflows/ios-healthkit-sign.yml` espera os seguintes GitHub Actions secrets:

- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64`

Para envio opcional ao TestFlight, também:

- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY_BASE64`

Esses valores não devem aparecer em commits, issues, logs ou mensagens públicas.

## Gate em aparelho físico

Depois de um IPA assinado:

1. instalar a build no iPhone;
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
