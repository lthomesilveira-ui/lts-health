# LTS Health v2 — contrato de auditoria de dados

Este arquivo é público e contém apenas regras de engenharia. Contagens, datas, valores, nomes de exames, detalhes de treinos e qualquer outro dado pessoal de saúde devem permanecer exclusivamente no backend privado e nos testes autenticados.

## Cobertura por domínio

A auditoria operacional deve verificar, no backend privado, a existência e a integridade dos seguintes domínios sem copiar resultados para o repositório:

- composição corporal e composição segmentar;
- treinos, exercícios e séries;
- resultados laboratoriais e documentos;
- nutrição diária, refeições e atividade;
- métricas gerais e fontes passivas;
- eventos históricos de tratamentos;
- uploads, previews de ingestão e qualidade dos dados.

As telas calculam contagens e intervalos a partir dos registros carregados na sessão autenticada. Nenhum total pessoal é fixado no código ou em documentação pública.

## Reconciliação de treinos

- A sessão estruturada é a representação principal do treino quando a fonte oferece evidência suficiente.
- Exercícios e séries só são derivados quando o texto ou arquivo de origem permite a decomposição sem inferência.
- Texto bruto histórico é preservado quando não houver estrutura suficiente.
- Um exercício pode ser recuperado como registro navegável a partir de evidência textual sem que séries sejam inventadas; nesse caso o texto original permanece explícito como registro da fonte.
- Registros sem evidência corroborante permanecem fora do histórico principal e não são promovidos por conveniência.
- Repetições, cargas, unidades, máquinas e nomes de exercícios ausentes não são preenchidos por suposição.
- Uma correção de migração deve manter rastreabilidade no ledger de qualidade e registrar explicitamente quando nenhuma série foi inferida.

## Reconciliação de composição corporal

- A linha temporal estruturada deve preservar as datas e valores provenientes das fontes originais.
- Dados segmentares só aparecem quando os campos necessários existem na fonte estruturada.
- Diferenças entre datas ou lados são descritivas e não recebem rótulos de ideal, melhor ou pior.
- Conflitos entre inventário de documentos e dados estruturados não são reconciliados por proximidade de data; dependem da fonte original.

## Nutrição

- Médias usam somente dias que possuem registros.
- Dias, meses ou anos sem dados permanecem lacunas; ausência não significa consumo zero, jejum ou aderência.
- Refeições e totais diários podem ter granularidades diferentes e não são forçados a coincidir.
- MyFitnessPal descreve nutrição e atividade exportada, mas atividade importada não substitui uma sessão de treino estruturada.

## Apple Saúde, Polar e sobreposição de fontes

1. Treino estruturado do LTS Health é a sessão principal quando representa o mesmo evento observado por outras fontes.
2. Apple Saúde pode atuar como hub passivo para métricas com regra de consolidação explicitamente validada.
3. Energia ativa, minutos de exercício, horas em pé e duração do sono possuem caminhos automáticos validados no parser estável atual.
4. Passos e frequência cardíaca de repouso não fazem parte da ingestão automática validada atual e não devem ser apresentados como importação automática suportada.
5. Polar pode complementar uma sessão com detalhe adicional quando o arquivo real permitir validação, sem criar uma segunda sessão nem somar valores duplicados.
6. Nenhum valor de múltiplas fontes é agregado automaticamente sem regra determinística específica.
7. Unidades incompatíveis nunca são convertidas por suposição.

## Laboratórios e documentos

- Resultados estruturados permanecem vinculados a coleta, laboratório, unidade, referência, método e origem quando esses campos existem.
- Tendência só é calculada entre valores numéricos com unidades compatíveis.
- Resultado textual é preservado como texto quando não houver valor numérico seguro.
- Linhas ambíguas permanecem retidas para revisão em vez de serem forçadas para a tabela estruturada.
- CSV, PDF ou imagem de Fleury, Einstein ou outra fonte laboratorial é preservado; a extração especializada só pode ser conectada ao frontend após validação com amostras reais suficientes.
- O frontend nunca fabrica biomarcadores a partir do nome do arquivo ou de metadados incompletos.
- Inventário de metadados não é tratado como prova de que o arquivo original esteja disponível para abertura.
- Coincidência temporal entre exame, treino, alimentação, sono ou tratamento não é apresentada como causalidade.

## Roteamento de ingestão

- O frontend v2 usa `health-inspect-upload` como inspetor estável para todas as origens enquanto os parsers especializados não completarem seu gate de validação.
- Lógicas experimentais ou mais amplas podem existir separadamente, mas não são selecionadas silenciosamente pelo frontend.
- Apple Saúde só anuncia como ingestão automática as métricas já validadas no inspetor estável.
- Fleury e Einstein preservam o arquivo e a revisão; um parser especializado só entra no fluxo normal depois de validado em amostras reais.
- O arquivo original permanece no armazenamento privado independentemente do caminho de processamento.

## Qualidade dos dados

O ledger privado diferencia estado operacional de limitação conhecida:

- `open`: existe uma ação interna concreta que pode ser executada agora; este estado é o backlog operacional real;
- `accepted`: a limitação está identificada e corretamente contida, mas depende de arquivo, identificação ou outra evidência externa para mudar; não deve bloquear o produto nem ser preenchida por inferência;
- `resolved`: houve uma ação concreta e auditável que encerrou a inconsistência.

A interface deve apresentar esses grupos separadamente como **Ação necessária**, **Limitações conhecidas** e **Resolvidos**. Uma limitação aceita nunca pode ser usada para inflar artificialmente o número de pendências internas.

## Gate para a nova interface

A v2 deve derivar seu estado exclusivamente das tabelas dedicadas do LTS Health. Uma consulta que falha produz estado de indisponibilidade, nunca um zero falso. Dados pessoais usados nos gates de QA ficam no ambiente autenticado e não são copiados para este repositório público.
