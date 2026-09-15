# LTS Health — auditoria pública visual e funcional — 15/09/2026

Checkpoint público de engenharia. Não contém dados pessoais de saúde, capturas privadas, credenciais nem material de autenticação.

> Estado posterior: este fechamento visual foi invalidado pelas oito capturas do iPhone físico fornecidas pelo proprietário. A versão `.26` permanece registrada como deploy histórico, mas está rejeitada para homologação. A remediação vigente está em `PHYSICAL_IPHONE_REMEDIATION_20260915.md`.

## Escopo e autoridade

Esta auditoria foi iniciada a partir do produto realmente publicado, e não de uma suposição baseada em CI. A autoridade visual foi a imagem mobile aprovada preservada no Drive privado como `LTS Health - referencia visual aprovada.png`, SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`.

O app público auditado foi `https://lthomesilveira-ui.github.io/lts-health/v2/`. A versão final deste pacote é:

- build `ux-coherence-public-visual-closure-20260915.26`;
- produto no PR #292;
- commit do produto `3519968f82eb6043a8835e7fa9ad8b5e2be27395`;
- merge normal em `main` `cb4ec22f9fe9c5f3f00b2c9875db7d6e9ea7c5cf`.

Nenhuma afirmação abaixo substitui a homologação subjetiva do proprietário ou a inspeção em iPhone físico.

## Método executado

1. O estado real de `main`, `architecture-v2`, documentos de continuidade e releases recentes foi recuperado antes da alteração.
2. A referência privada aprovada foi recuperada, aberta e comparada diretamente com Home, resumo de treino e exercícios publicados.
3. O link público final foi aberto no Cloud Browser, com sessão autenticada persistida e confirmação do build `.26` no documento entregue pelo GitHub Pages.
4. Home, Timeline, Treinos, Composição, Nutrição, Exames, Recuperação, Protocolos, Dados e Evolução foram alcançados por navegação real e tiveram rota, título, estado ativo e conteúdo conferidos.
5. O E2E autenticado final produziu 32 capturas privadas — 12 desktop e 20 mobile — cobrindo as telas principais e seus drill-downs. O artefato foi baixado, teve o digest conferido, foi descriptografado somente no ambiente temporário e cada captura foi inspecionada.
6. Problemas óbvios encontrados na própria auditoria foram corrigidos, promovidos e novamente verificados antes deste checkpoint.

## Comparação direta

| Superfície | Autoridade aprovada | Produto público `.26` | Diferença e decisão |
| --- | --- | --- | --- |
| Home mobile | Cabeçalho compacto em casca escura, três métricas de composição, `Hoje`, progresso semanal e navegação inferior | Mantém essa ordem e hierarquia, usando somente dados reais e estados vazios explícitos | Manter. A implementação não copia exemplos, metas ou valores ilustrativos da referência. Paridade pixel não é alegada. |
| Resumo de treino | Abas claras, sessão vermelha protagonista e métricas legíveis antes do detalhe | Preserva a sessão protagonista, `Resumo / Exercícios / Histórico`, métricas disponíveis e telemetria vinculada à fonte | Manter. Gráficos, zonas ou imagens ausentes na evidência real não são fabricados apenas para imitar o mockup. |
| Exercícios e séries | Leitura direta por exercício, séries escaneáveis e acesso progressivo | Mostra todos os exercícios e séries disponíveis, observações e histórico do exercício, sem limite silencioso | Manter a profundidade. Fotos de equipamentos não são inventadas quando não existe ativo canônico. |
| Navegação mobile | Cinco destinos fixos e um único destino ativo | Um único destino fica ativo em todas as rotas; telas secundárias são representadas por `Mais` | Corrigido. Timeline, Nutrição, Recuperação, Protocolos, Dados e Evolução não deixam outro item ativo em paralelo. |
| Composição e Exames | Hierarquia compacta, cor com função e detalhe progressivo | Resumos, tendências seguras, filtros e históricos completos usam a mesma linguagem visual | Manter. Comparações incompatíveis continuam bloqueadas e resultados textuais permanecem legíveis. |
| Nutrição e hidratação | Área integrada, sem transformar ausência em zero | Histórico e detalhe diário foram preservados; a ausência de água histórica fica explícita | Corrigido o controle secundário que parecia um botão padrão do navegador. A execução autenticada do extrator continua deliberadamente pendente. |
| Evolução desktop/mobile | Densidade consistente, sem vazio estrutural ou blocos concorrentes | Ritmo de treinos aparece antes da análise segmental; ambos ocupam a largura disponível | Corrigido o grid inferior que criava uma coluna vazia e hierarquia assimétrica. |
| Casca e foco | Interface de produto coerente, sem artefatos do navegador | Rail/canvas no desktop, topbar e navegação inferior no mobile, títulos limpos | Corrigidos ação contextual obsoleta durante troca de rota e contorno visual indevido em títulos focados por código. |

## O que foi preservado

- histórico completo e paginação de Treinos, Composição, Exames e Nutrição;
- sessão → exercício → série e histórico descritivo por exercício;
- detalhe de medição e vínculo segmental somente quando seguro;
- seleção de marcador, origem, unidade, método, período e histórico completo de Exames;
- Timeline por ano, mês e dia exato;
- análise de recuperação separada por fonte;
- tratamentos apenas como contexto temporal, sem inferência de estado ou orientação;
- proveniência, estados parciais, ambiguidades e comportamento fail-closed;
- Dados, qualidade, imports e backup estruturado.

## Correções promovidas durante a auditoria

- PR #285: reconstrução auditada de Home e Treinos, preservando profundidade real.
- PR #286: legibilidade das rotas internas e cobertura mobile completa.
- PR #287: correções encontradas na inspeção pública e alinhamento do grid de Evolução.
- PR #288: estabilidade da captura autenticada.
- PR #289: QA autenticado passou a usar navegação real da interface.
- PR #290: prontidão específica por rota antes da captura.
- PR #291: remoção de ações mobile obsoletas durante transições.
- PR #292: exclusividade do destino ativo, controle secundário de hidratação, foco programático e fechamento do layout de Evolução.

## Evidência final

Todos os nove workflows pós-merge do produto concluíram com sucesso:

- Homologation Pages Smoke `34926104853`;
- v2 Pages Smoke `34926104855`;
- Real Auth E2E `34926079772`;
- Deploy `34926079874`;
- Recovery Depth `34926079734`;
- Nutrition History `34926079802`;
- LTS Health Smoke `34926079764`;
- Timeline Smoke `34926079615`;
- Functional Depth `34926079881`.

O artefato autenticado final é `10379557671`, nome `real-auth-visual-evidence-encrypted`, digest SHA256 `152f3a0ca8b70676ca3380da4711ff66b256589b6d82b791bd819c3b57ac174b`. Ele permanece criptografado no GitHub; nenhum screenshot descriptografado ou material de chave entra no repositório.

Além dos gates, o Cloud Browser abriu o URL público final, confirmou o build `.26`, percorreu todas as áreas e não encontrou erro de aplicação, overflow horizontal ou destino incoerente. As capturas autenticadas confirmaram a composição mobile/desktop e os drill-downs. Isso é QA próprio executado; não é aceite do proprietário.

## Estado ao fechar o pacote

Não ficou defeito visual ou funcional óbvio identificado dentro do escopo auditado. A próxima ação de produto é a homologação subjetiva do proprietário no app público, especialmente em iPhone físico. Qualquer divergência observada no aparelho volta a prevalecer sobre esta evidência automatizada ou remota.

A extração histórica autenticada de água do MyFitnessPal continua em `LTS-HYD-IMPORT-001`, por decisão anterior do proprietário. O extrator já existe; essa ação não bloqueia a evolução do aplicativo.
