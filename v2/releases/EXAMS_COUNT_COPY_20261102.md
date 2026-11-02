# Exames — contagens singulares

## Defeito observado

Na jornada móvel exata de Exames da publicação `.118`, o resumo de um único marcador exibia “1 marcadores” e o seletor exibia “1 encontrados”. A informação numérica estava correta; a concordância textual não estava.

## Correção delimitada

- Usa a função compartilhada de pluralização para marcador/resultado e encontrado/encontrados.
- Mantém um contrato explícito para um marcador e dois resultados.
- Não altera dados laboratoriais, seleção, filtros, séries, referências, originais ou persistência.

## Evidência de publicação

- `node v2/history-depth-contract.mjs`: aprovado.
- `git diff --check`: aprovado.
- PR488: candidata exata `c68845065b8949bb377acdd12c0e119cd6950643`, tree `ee8fd358be2de5b49a1646393a876bd5e8167122`, 19/19 workflows aprovados.
- Artefato `isolated-preview-synthetic-visual` 13116078628: `sha256:4114fa7974444bb90f5865023a074389d6b1f6e1c8f2a3ee41637fee27f764cd`; as capturas de393px exibem as duas concordâncias corrigidas.
- Merge normal `538a18bb7248b022477c8762f9969308c3353b71`: 23/23 workflows pós-merge aprovados, incluindo deploy, Pages e autenticação real.
- A entrada estável abriu `health-integrated-20261102.119` na sessão genuína autenticada. Exames preservou158 marcadores,809 resultados, datas, unidades, método, referências, originais e paginação.

Os nove bloqueios externos, as duas lacunas aceitas e as duas alternativas substituídas continuam separados desta correção de apresentação.
