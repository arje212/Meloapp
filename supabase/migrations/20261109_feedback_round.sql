-- Changes needed by the tester-feedback update. Safe to run more than once (SQL Editor).

-- 1) Threaded comment replies: parent_id has the same type as comments.id
do $$
declare id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a where a.attrelid = 'public.comments'::regclass and a.attname = 'id' and not a.attisdropped;
  execute format('alter table public.comments add column if not exists parent_id %s references public.comments(id) on delete cascade', id_type);
end $$;
create index if not exists comments_parent_idx on public.comments (parent_id);

-- 2) Agencies: official business email + GCash QR code (the QR replaces the personal number in the booking screen)
alter table public.agencies add column if not exists contact_email text;
alter table public.agencies add column if not exists gcash_qr_url  text;

-- 3) Account deactivation (signing in again reactivates)
alter table public.profiles add column if not exists deactivated_at timestamptz;

-- 4) Account deletion requests (Google Play requires an in-app way to ask for deletion)
create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  email        text,
  status       text not null default 'pending',
  requested_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
drop policy if exists "deletion_insert_own" on public.account_deletion_requests;
drop policy if exists "deletion_select_own" on public.account_deletion_requests;
create policy "deletion_insert_own" on public.account_deletion_requests for insert to authenticated with check (user_id = auth.uid());
create policy "deletion_select_own" on public.account_deletion_requests for select to authenticated using (user_id = auth.uid());

-- 5) Booking emails: tell the `send-booking-email` Edge Function when a booking is created or changes status
create schema if not exists private;
create table if not exists private.email_config (
  id             int primary key default 1 check (id = 1),
  function_url   text,
  webhook_secret text
);
create extension if not exists pg_net;

create or replace function private.notify_booking_email()
returns trigger
language plpgsql
security definer
set search_path = public, private, net
as $$
declare
  cfg record;
  old_json jsonb := null;
begin
  select function_url, webhook_secret into cfg from private.email_config where id = 1;
  if cfg.function_url is null or cfg.webhook_secret is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    old_json := to_jsonb(old);
  end if;
  perform net.http_post(
    url := cfg.function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', cfg.webhook_secret),
    body := jsonb_build_object('table', tg_table_name, 'type', tg_op, 'record', to_jsonb(new), 'old_record', old_json),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new; -- a failed email must never block a booking
end;
$$;

do $$
begin
  if to_regclass('public.bookings') is not null then
    drop trigger if exists email_on_booking_insert on public.bookings;
    create trigger email_on_booking_insert after insert on public.bookings
      for each row execute function private.notify_booking_email();
    drop trigger if exists email_on_booking_status on public.bookings;
    create trigger email_on_booking_status after update of status on public.bookings
      for each row when (old.status is distinct from new.status)
      execute function private.notify_booking_email();
  end if;
end $$;

-- 6) Choice of what customers see for GCash: 'qr' (QR code only) or 'number'
alter table public.agencies add column if not exists gcash_display text check (gcash_display in ('qr', 'number'));
alter table public.trips    add column if not exists gcash_qr_url  text;
alter table public.trips    add column if not exists gcash_display text check (gcash_display in ('qr', 'number'));
