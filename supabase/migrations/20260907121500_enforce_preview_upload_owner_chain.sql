begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.health_uploads
  add constraint health_uploads_user_id_id_key
  unique (user_id, id);

alter table public.health_ingestion_previews
  drop constraint health_ingestion_previews_upload_id_fkey;

alter table public.health_ingestion_previews
  add constraint health_ingestion_previews_upload_owner_fk
  foreign key (user_id, upload_id)
  references public.health_uploads(user_id, id)
  on delete cascade;

commit;
