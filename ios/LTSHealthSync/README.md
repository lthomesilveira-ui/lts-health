# LTS Health Sync (iOS)

Companheiro nativo do LTS Health para leitura autorizada do Apple Saúde e sincronização incremental com o backend Supabase do projeto.

## Escopo automático v1

Somente três métricas do `HKActivitySummary` são enviadas como família `apple_activity_summary` e podem ser promovidas automaticamente pelo backend já validado:

- `active_energy_kcal`
- `exercise_minutes`
- `stand_hours`

Passos e demais métricas não são promovidos automaticamente por este cliente.

## Fluxo

1. O usuário entra com a mesma conta do LTS Health.
2. A sessão Supabase é mantida no Keychain do aparelho (`ThisDeviceOnly`).
3. O usuário toca em **Conectar Apple Saúde** e concede permissão de leitura.
4. O app faz uma carga inicial de até 365 dias de `HKActivitySummary`, em lotes pequenos e idempotentes.
5. `HKObserverQuery` monitora mudanças em energia ativa, tempo de exercício e tempo em pé.
6. `HKAnchoredObjectQuery` avança uma âncora persistida para cada tipo e detecta inclusões/deleções.
7. Quando há mudança, o app recalcula os resumos recentes e chama `health-apple-sync-batch`.
8. A Edge Function usa a RPC transacional `health_promote_apple_activity_summary`; estados `held`/`superseded` continuam protegidos.

## Segurança

- Nenhuma service-role key é embutida no app.
- A chave presente no cliente é somente a chave publicável do mesmo projeto usada pelo web app.
- Tokens são armazenados no Keychain.
- A Edge Function exige JWT válido.
- O backend continua responsável pela identidade determinística e pela promoção canônica.

## Gerar o projeto Xcode

Requer Xcode e XcodeGen:

```bash
cd ios/LTSHealthSync
xcodegen generate
open LTSHealthSync.xcodeproj
```

No target `LTSHealthSync`, mantenha a capability **HealthKit** habilitada e o entitlement de **Background Delivery**. Para background delivery real, o teste precisa ser feito em iPhone físico; a Apple não oferece esse comportamento completo no Simulator.

## Build de CI

O workflow `ios-healthkit-build.yml` gera o projeto e executa `xcodebuild` para o iOS Simulator com code signing desabilitado. Isso valida compilação, mas não substitui o gate em aparelho físico para autorização e background delivery.
