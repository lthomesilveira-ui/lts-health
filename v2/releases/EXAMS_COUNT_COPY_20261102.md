# Exames — contagens singulares

## Defeito observado

Na jornada móvel exata de Exames da publicação `.118`, o resumo de um único marcador exibia “1 marcadores” e o seletor exibia “1 encontrados”. A informação numérica estava correta; a concordância textual não estava.

## Correção delimitada

- Usa a função compartilhada de pluralização para marcador/resultado e encontrado/encontrados.
- Mantém um contrato explícito para um marcador e dois resultados.
- Não altera dados laboratoriais, seleção, filtros, séries, referências, originais ou persistência.

## Evidência antes da publicação

- `node v2/history-depth-contract.mjs`: aprovado.
- `git diff --check`: aprovado.
- Candidata: `health-integrated-20261102.119`.

Os gates remotos, a publicação e a inspeção do build exato permanecem pendentes e não são contados antecipadamente.
