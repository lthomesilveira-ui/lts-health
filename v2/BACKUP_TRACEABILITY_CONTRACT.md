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
- `record_total` como soma das contagens por domínio
- `domains` e `counts` como manifesto estrutural
- `domain_manifest` com contagem, presença, campos observados e hash por domínio
- `integrity` com SHA-256 do conjunto de dados estruturados e de cada domínio

## Fail-closed

A exportação continua sendo fail-closed. Se qualquer loader de domínio falhar, o arquivo não é gerado como se estivesse completo.

## Integridade

Os hashes usam SHA-256 sobre a serialização JSON efetivamente exportada. O verificador recalcula o hash do conjunto de dados e de cada domínio. Uma alteração posterior nos registros causa falha de verificação no nível global e/ou do domínio afetado.

O manifesto de integridade serve para detectar alteração ou corrupção do JSON estruturado depois da exportação. Ele não é assinatura digital, não comprova autoria e não atesta criptograficamente os arquivos privados originais.

## Privacidade e limites

Não entram no backup verificável:

- arquivos privados originais;
- `storage_path`;
- credenciais, senhas, access tokens ou refresh tokens;
- payload bruto de origem;
- campos operacionais de tratamento que não pertencem ao contexto seguro preservado.

Dados ausentes continuam ausentes. Nenhuma métrica, dose, ingestão, resultado, treino ou valor de saúde é inferido para completar o backup.

## Gate obrigatório

`v2/backup-smoke.mjs` valida desktop e mobile, baixa o JSON real, confere o envelope v3, todos os domínios, as exclusões de privacidade, os hashes SHA-256 e o verificador. O teste também altera deliberadamente um valor de fixture e exige que a adulteração seja detectada.

`.github/workflows/backup-smoke.yml` executa esse contrato sempre que os arquivos de backup, wiring ou teste forem modificados nas branches cobertas ou em pull requests relevantes.
