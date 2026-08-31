create or replace function health_private.keep_upload_status_truthful_after_preview()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  preview_status text;
begin
  if new.status <> 'processing' then
    return new;
  end if;

  select p.status
    into preview_status
    from public.health_ingestion_previews p
   where p.user_id = new.user_id
     and p.upload_id = new.id
   order by p.updated_at desc
   limit 1;

  if preview_status in ('ready_for_parser','needs_specialized_parser','review_required') then
    new.status := 'review_required';
    new.notes := coalesce(new.notes, 'Arquivo reconhecido e preservado; aguarda leitura segura antes de entrar nas análises.');
  end if;

  return new;
end;
$$;

revoke all on function health_private.keep_upload_status_truthful_after_preview() from public;

drop trigger if exists health_uploads_keep_preview_status_truthful on public.health_uploads;
create trigger health_uploads_keep_preview_status_truthful
before update of status on public.health_uploads
for each row
execute function health_private.keep_upload_status_truthful_after_preview();