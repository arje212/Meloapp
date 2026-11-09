-- READ-ONLY checks. Paste into the Supabase SQL Editor and read the results. Changes nothing.

-- 1) Tables in "public" WITHOUT row level security (anyone with the public key can read/write them)
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 2) Policies that allow EVERYONE (anon included) to read/write: review each one carefully
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (roles && array['anon','public']::name[])
  and (qual = 'true' or with_check = 'true' or cmd in ('UPDATE','DELETE','INSERT','ALL'))
order by tablename, cmd;

-- 3) Update/delete policies that are not limited to the row's owner (qual = true)
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public' and cmd in ('UPDATE','DELETE','ALL') and qual = 'true'
order by tablename;

-- 4) Storage buckets that are public (their files are readable by anyone who has the link)
select id as bucket, public from storage.buckets order by public desc, id;
