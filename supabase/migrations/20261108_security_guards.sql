-- Security guards: things a normal user must never be able to change by calling the API directly.
-- (The app hides these buttons, but the database is the real lock.) Safe to run more than once.
-- Admin = a profile with role = 'admin'. SQL editor / service role (no signed-in user) is always allowed.

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Blocks changes to listed columns unless the caller is an admin.
create or replace function private.protect_columns()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  col text;
begin
  if auth.uid() is null or private.is_admin() then
    return new;
  end if;
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'Not allowed to change "%"', col using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

-- New agencies always start unapproved; paid plans always start pending (free plan stays auto-verified).
create or replace function private.force_safe_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null or private.is_admin() then
    return new;
  end if;
  if tg_table_name = 'agencies' then
    new := jsonb_populate_record(new, jsonb_build_object('status', 'pending', 'is_verified', false));
  elsif tg_table_name = 'agency_subscriptions' then
    if coalesce(new.plan, '') = 'free' then
      new := jsonb_populate_record(new, jsonb_build_object('amount', 0, 'status', 'verified'));
    else
      new := jsonb_populate_record(new, jsonb_build_object('status', 'pending'));
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists guard_profiles on public.profiles;
    create trigger guard_profiles before update on public.profiles
      for each row execute function private.protect_columns('role', 'is_blocked');
  end if;

  if to_regclass('public.agencies') is not null then
    drop trigger if exists guard_agencies_update on public.agencies;
    create trigger guard_agencies_update before update on public.agencies
      for each row execute function private.protect_columns('status', 'is_verified', 'commission_warning', 'owner_email');
    drop trigger if exists guard_agencies_insert on public.agencies;
    create trigger guard_agencies_insert before insert on public.agencies
      for each row execute function private.force_safe_insert();
  end if;

  if to_regclass('public.agency_subscriptions') is not null then
    drop trigger if exists guard_subs_update on public.agency_subscriptions;
    create trigger guard_subs_update before update on public.agency_subscriptions
      for each row execute function private.protect_columns('status', 'plan', 'amount', 'start_date', 'end_date');
    drop trigger if exists guard_subs_insert on public.agency_subscriptions;
    create trigger guard_subs_insert before insert on public.agency_subscriptions
      for each row execute function private.force_safe_insert();
  end if;
end $$;
