# LTS Health Sync (iOS)

Companheiro nativo do LTS Health para leitura autorizada do Apple Saúde e sincronização incremental com o backend Supabase do projeto. O dashboard web continua sendo a interface principal; o companion existe para tornar a ingestão HealthKit automática e de baixa interação no iPhone.

## Escopo automático atual

### Dados principais do Apple Saúde

Somente três métricas do `HKActivitySummary` usam a família `apple_activity_summary` e podem ser promovidas automaticamente pelo backend validado:

- `active_energy_kcal`
- `exercise_minutes`
- `stand_hours`

A promoção é feita pelo backend; o cliente iOS não escreve diretamente na tabela consolidada.

### Dados preservados por origem

O companion também lê e envia como candidatos, mantendo a origem separada:

- passos;
- frequência cardíaca de repouso;
- HRV SDNN;
- frequência respiratória;
- peso;
- calorias alimentares;
- proteína;
- carboidratos;
- gordura;
- fibra;
- volume de água realmente registrado no Apple Saúde;
- duração de sono.

O volume de água usa o tipo `dietaryWater` do HealthKit, é convertido para mililitros e mantido por origem. Ele não é estimado quando ausente, não é somado automaticamente entre fontes e não é promovido pelo caminho canônico de ActivitySummary. O Dashboard só poderá tratá-lo como hidratação consolidada quando existir dado real no aparelho e uma regra de seleção de origem explicitamente validada.

Quando o MyFitnessPal compartilha nutrição com o Apple Saúde, os nutrientes compatíveis podem chegar como totais diários da origem `myfitnesspal`. Isso não cria alimentos, refeições ou horários que o HealthKit não forneça e não transforma esses totais em nutrição consolidada sem validação.

Para sono, os intervalos classificados como dormindo são agrupados por dia e por origem. Sobreposições da mesma origem são unidas antes do cálculo da duração; Apple Watch, RingConn, Polar, iPhone e outras origens permanecem separadas e nunca são somadas automaticamente entre si. O sono continua fora da promoção automática do `HKActivitySummary`.

## Fluxo

1. O usuário entra com a mesma conta do LTS Health.
2. A sessão Supabase é mantida no Keychain do aparelho (`ThisDeviceOnly`).
3. O usuário toca em **Conectar Apple Saúde** e concede as permissões de leitura desejadas.
4. O app faz a carga inicial do `HKActivitySummary` e das métricas por origem em lotes pequenos.
5. `HKObserverQuery` acompanha alterações dos tipos autorizados e habilita background delivery.
6. No fluxo principal, `HKAnchoredObjectQuery` avança âncoras persistidas para os tipos de atividade e detecta mudanças sem materializar histórico ilimitado.
7. Para métricas por origem, o app recalcula janelas recentes de forma idempotente e envia lotes ao endpoint `health-apple-sync-batch`.
8. A Edge Function preserva cada origem em `health_source_daily_metrics`; somente o trio de `apple_activity_summary` pode seguir para a RPC transacional de promoção.
9. Estados revisados (`held`/`superseded`) continuam protegidos contra rebaixamento acidental.

## Segurança

- Nenhuma service-role key é embutida no app.
- A chave presente no cliente é somente a chave publicável do projeto.
- Tokens são armazenados no Keychain.
- A Edge Function exige JWT válido.
- O backend gera a identidade determinística dos registros e controla qualquer promoção para a visão consolidada.
- Dados de origens diferentes permanecem distinguíveis para auditoria e deduplicação.

## Gerar o projeto Xcode

Requer macOS com Xcode e XcodeGen:

```bash
cd ios/LTSHealthSync
xcodegen generate
open LTSHealthSync.xcodeproj
```

No target `LTSHealthSync`, a capability **HealthKit** e o entitlement de **Background Delivery** precisam permanecer habilitados. O bundle identifier do projeto é `com.ltshealth.sync` e o deployment target é iOS 17 ou superior.

## Validação automatizada já disponível

O workflow `ios-healthkit-build.yml`:

- valida o contrato HealthKit;
- gera o projeto Xcode;
- compila para iOS Simulator;
- compila para o SDK de iPhone físico;
- gera archive sem assinatura;
- publica o archive como artefato de CI.

Esses gates comprovam que o código compila nos SDKs alvo, mas não substituem autorização real do HealthKit nem background delivery em aparelho físico.

## Gate físico de ativação

A etapa final de conectividade precisa de um iPhone físico porque a autorização HealthKit e o comportamento real de background delivery dependem do aparelho. Para esse gate será necessário instalar uma versão assinada do companion, entrar na conta LTS Health e conceder as permissões do Apple Saúde. Depois disso, a validação deve confirmar no backend que novos registros chegam com a origem correta e sem mistura entre dispositivos. Para água, esse gate também precisa confirmar que `dietaryWater` realmente existe no aparelho e chega como volume em mililitros, sem consolidar fontes diferentes automaticamente.

A instalação assinada pode ser feita por Xcode em um Mac com uma equipe de assinatura válida. Distribuição por TestFlight exige uma conta Apple Developer/App Store Connect configurada; o archive de CI atual é propositalmente não assinado e não deve ser tratado como aplicativo instalável em produção.
