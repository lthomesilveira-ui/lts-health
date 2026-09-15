# LTS Health — reconstrução da Home pela referência — 15/09/2026

Checkpoint público de engenharia em andamento. Não contém dados pessoais de saúde, capturas privadas, credenciais ou material de autenticação.

## Motivo

O proprietário abriu o build `.29` e confirmou que a Home publicada ainda não entregava o dashboard combinado. Essa rejeição prevalece sobre CI, deploy e alegações técnicas anteriores. A imagem privada aprovada foi reaberta e comparada diretamente antes desta reconstrução.

## Comparação e decisão

| Área | Referência aprovada | Build `.29` publicado | Candidato `.30` |
| --- | --- | --- | --- |
| Primeira leitura mobile | Marca, saudação, três métricas, Hoje e progresso semanal em hierarquia compacta | Estrutura semelhante, mas com densidade e composição ainda percebidas como dashboard genérico | Reconstrução canônica da Home com canvas escuro, cartões claros e a ordem exata da primeira tela |
| Evolução | Leitura longitudinal com acesso progressivo ao detalhe | Panorama fragmentado e sem protagonismo suficiente | Um gráfico principal, quatro períodos e oito métricas selecionáveis |
| Cobertura funcional | Treino, nutrição, água, exames, recuperação e tratamentos acessíveis | Dados e rotas existiam, mas a Home não os articulava como cockpit | Seis domínios compactos, acontecimentos recentes e proveniência, preservando os drill-downs existentes |
| Confiabilidade | Dado ausente não pode ser confundido com falha | Uma falha transitória da composição produziu traços até a atualização manual | Uma repetição limitada antes do erro, com falha e ausência ainda distintas |

## Implementação candidata

- build `home-dashboard-reference-20260915.30`;
- Home responsiva reescrita em `v2/src/home-reference.js` e `v2/home-reference.css`;
- padrão mobile: cabeçalho, três métricas, Hoje, progresso semanal, evolução, faixa de domínios, acontecimentos e contexto;
- padrão desktop: Hoje/progresso ao lado da evolução, seguido por panorama, acontecimentos e proveniência;
- período inicial da Home em 30 dias, sem alterar a janela global das áreas internas;
- energia estimada e frequência cardíaca parcial do treino continuam qualificadas pela evidência estruturada;
- pendência da água histórica do MyFitnessPal permanece visível e não bloqueia o pacote.

## Gates locais concluídos

- integridade informacional da Home;
- comparação visual de fixture em `1440 × 900` e `393 × 852`;
- viewport físico reduzido `393 × 650`;
- troca das oito métricas e dos períodos;
- navegação e preservação das telas internas;
- contratos de proveniência, telemetria parcial e payload público.

## Estado

Em execução. Publicação por PR normal, inspeção do build público autenticado, revisão desktop/mobile e correção de defeitos óbvios continuam obrigatórias antes de solicitar julgamento do proprietário. CI verde não encerra este checkpoint.
