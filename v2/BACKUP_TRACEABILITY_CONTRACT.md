# LTS Health — Backup estruturado verificável

## Objetivo

O backup do LTS Health preserva os registros estruturados acessíveis à sessão em um único JSON exportável, sem reconstruir campos ausentes e sem incorporar arquivos privados originais, credenciais, tokens ou payloads brutos de origem.

## Contrato v3

O envelope usa:

- `format: lts-health-structured-backup`
- `schema_version: 3`
- `traceability_version: 1`
- `scope: structured_records_only`
- `complete: true` somente quando todos os domínios estruturados suportados foram lidos com sucesso
- `structured_complete: true` com o mesmo limite de escopo
- `export_id` exclusivo para a exportação
- `record_total` como soma das contagens reais por domínio
- `domains` e `counts` como manifesto estrutural
- `domain_manifest` com contagem, presença, campos observados e hash por domínio
- `integrity` com SHA-256 do conjunto de dados estruturados e de cada domínio

## Fail-closed

A exportação continua sendo fail-closed. Se qualquer loader de domínio falhar, o arquivo não é gerado como se estivesse completo.

## Verificação estrutural e de integridade

O verificador não confia apenas no hash global. Ele cruza o próprio envelope e o manifesto com o conteúdo efetivamente presente no JSON:

- formato, versão, escopo e flags de completude;
- exclusões declaradas de arquivos privados e credenciais;
- `export_id` e data de exportação;
- unicidade e conjunto exato de domínios;
- conjunto exato das chaves de `data`, `counts`, manifesto e hashes por domínio;
- contagem de cada domínio versus o número real de registros;
- `record_total` versus a soma real dos registros;
- `non_empty` versus a presença real de registros;
- lista de campos observados versus os campos realmente exportados;
- SHA-256 global e SHA-256 de cada domínio.

Os hashes usam SHA-256 sobre a serialização JSON efetivamente exportada. Uma alteração posterior nos registros, contagens, manifesto ou hashes faz a verificação falhar.

O manifesto de integridade serve para detectar alteração ou corrupção do JSON estruturado depois da exportação. Ele não é assinatura digital, não comprova autoria e não atesta criptograficamente os arquivos privados originais.

## Verificação local pela tela Dados

A tela **Dados** oferece a ação **Verificar backup**. O arquivo escolhido é lido localmente pelo navegador e não é enviado ao servidor. A interface informa apenas se o arquivo passou na verificação estrutural e de integridade, sem exibir payloads internos ou erros técnicos.

Um backup aprovado mostra a quantidade de registros estruturados e de áreas verificadas. Um arquivo adulterado, incompatível ou inválido é rejeitado como cópia confiável. A leitura local aceita até 100 MB por arquivo para evitar processamento excessivo no navegador.

## Privacidade e limites

Não entram no backup verificável:

- arquivos privados originais;
- `storage_path`;
- credenciais, senhas, access tokens ou refresh tokens;
- payload bruto de origem;
- campos operacionais de tratamento que não pertencem ao contexto seguro preservado.

Dados ausentes continuam ausentes. Nenhuma métrica, dose, ingestão, resultado, treino ou valor de saúde é inferido para completar o backup.

A verificação local confirma somente a consistência do backup estruturado e dos hashes que ele próprio contém. Ela não transforma o arquivo em prova de autoria, assinatura digital ou atestado dos arquivos privados originais.

## Gates obrigatórios

`v2/backup-smoke.mjs` valida desktop e mobile, baixa o JSON real, confere o envelope v3, todos os domínios, as exclusões de privacidade, os hashes SHA-256 e o verificador. O teste também altera deliberadamente um valor de fixture e exige que a adulteração seja detectada.

`v2/backup-verification-ui-smoke.mjs` valida o fluxo visível de verificação local em desktop e mobile. Ele exige aprovação de um backup válido e rejeição de JSON adulterado ou malformado, além de adulterações específicas de contagens, campos do manifesto, `non_empty`, domínios duplicados e conjuntos incompletos de contagens/hashes.

`.github/workflows/backup-smoke.yml` executa os dois contratos em pull requests para `architecture-v2` e nas branches cobertas sempre que o código, wiring ou testes do backup forem modificados.
