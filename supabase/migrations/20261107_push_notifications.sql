-- Push notifications: device tokens + database triggers that call the `send-push` Edge Function.
-- Safe to run more than once.

-- 1) Where each phone's push token is stored -------------------------------------------------
create table if not exists public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  email        text not null,
  token        text not null unique,
  platform     text,
  updated_at   timestamptz not null default now(),
  created_date timestamptz not null default now()
);
create index if not exists device_tokens_email_idx on public.device_tokens (lower(email));

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_select_own" on public.device_tokens for select using (user_id = auth.uid());
create policy "device_tokens_delete_own" on public.device_tokens for delete using (user_id = auth.uid());
-- inserts/updates go through register_device_token() below so a phone can change owner safely

create or replace function public.register_device_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  insert into public.device_tokens (user_id, email, token, platform, updated_at)
  values (auth.uid(), v_email, p_token, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        email = excluded.email,
        platform = excluded.platform,
        updated_at = now();
end;
$$;
revoke all on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

-- 2) Private config (not exposed through the API) ------------------------------------------
create schema if not exists private;
create table if not exists private.push_config (
  id             int primary key default 1 check (id = 1),
  function_url   text,
  webhook_secret text
);
-- Fill this in ONCE in the SQL editor (see PUSH_SETUP.md). Do not commit the secret.

-- 3) Trigger: tell the Edge Function about every new chat message / notification -----------
create extension if not exists pg_net;

create or replace function private.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, private, net
as $$
declare
  cfg record;
begin
  select function_url, webhook_secret into cfg from private.push_config where id = 1;
  if cfg.function_url is null or cfg.webhook_secret is null then
    return new;
  end if;
  perform net.http_post(
    url := cfg.function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', cfg.webhook_secret),
    body := jsonb_build_object('table', tg_table_name, 'type', tg_op, 'record', to_jsonb(new)),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new; -- a push problem must never stop a message from being saved
end;
$$;

drop trigger if exists push_on_chat_message on public.chat_messages;
create trigger push_on_chat_message
  after insert on public.chat_messages
  for each row execute function private.notify_push();

drop trigger if exists push_on_notification on public.notifications;
create trigger push_on_notification
  after insert on public.notifications
  for each row execute function private.notify_push();
