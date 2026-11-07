-- No credential value or activation is seeded by this migration.
-- Only the existing privileged server may read these two fixed-purpose Vault entries.
create or replace function public.health_google_server_configuration()
returns table(enabled boolean, token_encryption_key text)
language sql stable security definer set search_path = ''
as $function$
  with settings as (
    select
      coalesce(marker.decrypted_secret = 'true',false) and
      case when secret_key.decrypted_secret ~ '^[A-Za-z0-9+/]{43}=$'
        then pg_catalog.octet_length(pg_catalog.decode(secret_key.decrypted_secret,'base64')) = 32
        else false end as enabled,
      secret_key.decrypted_secret as token_encryption_key
    from vault.decrypted_secrets marker
    left join vault.decrypted_secrets secret_key
      on secret_key.name = 'lts_health_google_token_encryption_key'
    where marker.name = 'lts_health_google_connection_enabled'
  )
  select settings.enabled,
    case when settings.enabled then settings.token_encryption_key else null end
  from settings;
$function$;

revoke all on function public.health_google_server_configuration() from public,anon,authenticated;
grant execute on function public.health_google_server_configuration() to service_role;
