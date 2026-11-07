# Google Health: configuração privada pelo Vault

A edição de segredos pelo painel não concluiu a ativação. A candidata mantém as credenciais OAuth no ambiente privado e permite que o servidor leia uma chave própria de32bytes e sua ativação no Vault. A função SQL é sem parâmetros, tem search_path vazio e acesso EXECUTE exclusivo do service_role. Nenhum grant direto ao Vault é acrescentado. A migration não inclui chave, identificador gerado, dado clínico nem ativação.

Uma desativação explícita no ambiente vence o Vault. Ausência de ativação preserva a instalação legada explicitamente configurada; falha, forma inválida, chave inadequada e desativação do Vault recusam a configuração. A leitura privada acontece após autenticação e validação do pedido. A desconexão é gravada mesmo quando a leitura posterior da configuração falha.

Os testes sintéticos verificam ACLs, ausência de grants, ativação e desativação, chave inválida, preservação ao reaplicar e autorização/callback com a mesma chave privada. Testes PostgreSQL dependem do gate remoto no banco descartável PostgreSQL17.11. Publicação e conferência genuína ainda não concluídas.

A capacidade configurada não comprova consentimento, perfil Google Health vinculado, leitura real, conciliação das origens nem recorrência. As nove dependências originais continuam independentes. O frontend e a água canônica permanecem como antes.

Referências primárias: https://supabase.com/docs/guides/database/vault e https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal.
