# Configuração protegida Google Health entregue

O servidor passou a resolver sua própria chave e ativação no Vault porque a edição de credenciais pelo painel não concluiu o preenchimento. O navegador recebe somente o estado da ligação. A RPC não aceita parâmetros e permite EXECUTE apenas ao service_role; nenhum grant de Vault foi acrescentado. A chave de32bytes foi gerada pelo pgcrypto e permaneceu protegida no servidor. Não existem valores de credenciais ou identificadores pessoais neste documento.

A desativação explícita do ambiente vence o Vault; ausência de ativação preserva a instalação legada configurada. Erro, forma inválida, chave inadequada e desativação privada recusam a configuração. A consulta privada segue autenticação e validação do pedido. Desconexão ainda é gravada mesmo se a consulta posterior falhar.

PR507 candidata fee6b6261dedfc59e2a57618478c42a5f2ec3c60, árvore14e3427c0377c0477c80d59ac05ece24b6d1c74f:17/17workflows aprovados. O gate Google42412437986 aprovou60testes Node e14casos PostgreSQL17.11. Merge normal c13cb9be8dabee56761b2c21cb31c34500d968e7 preservou a árvore;21/21workflows de publicação aprovados. Não foram repetidos testes sem mudança.

Migration nativa20261107204909, origem CLI20261107203628_google_health_server_vault_configuration.sql. ACLs, search_path vazio e finalidade fixa foram conferidos no projeto. As rotas health-google-connection e health-google-callback, versão4, foram relidas com os seis arquivos exatos; connection conserva verify_jwt=true e callback conserva verify_jwt=false com estado/PKCE de uso único. A ativação existente foi reconhecida pela guarda, preservando a chave comprovada; nenhuma nova rotação foi executada.

A conferência genuína autenticada mostrou “Pronta para conectar” e “Conectar Google Health”. A sonda pública de estado inválido retornou invalid_callback, confirmando a configuração e a rejeição do retorno indevido. A verificação Google do titular e o consentimento permanecem pendentes. Nenhum token, segredo, dado clínico ou valor de hidratação foi retornado por essa conferência. Fonte real, conciliação das origens e recorrência continuam com aceites próprios; o frontend segue .126.

Referências primárias: https://supabase.com/docs/guides/database/vault e https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal.
