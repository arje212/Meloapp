-- OPTIONAL - run manually in the Supabase SQL editor, NOT by the app.
-- Subscriptions approved before dates were stored have start_date/end_date = NULL, so the app
-- treats them as "no expiry". This gives them a 1-year window counted from when they were created.
-- WARNING: any plan created more than 1 year ago will immediately count as expired (Free rate/limits).

-- 1) PREVIEW first:
select id, agency_name, plan, created_date,
       (created_date::date)                          as new_start_date,
       ((created_date::date) + interval '1 year')::date as new_end_date
from agency_subscriptions
where status = 'verified' and plan <> 'free' and end_date is null
order by created_date;

-- 2) Apply only after reviewing the preview (adjust the WHERE to skip agencies you want to grandfather):
-- update agency_subscriptions
-- set start_date = created_date::date,
--     end_date   = ((created_date::date) + interval '1 year')::date
-- where status = 'verified' and plan <> 'free' and end_date is null;
