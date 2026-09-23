-- The application has always written matched_keyword, but the linked schema
-- lost the column during its pre-migration-history setup. Restore it without
-- discarding the two existing history rows.

alter table public.alert_history
  add column if not exists matched_keyword text;

update public.alert_history as history
set matched_keyword = preference.keyword
from public.alert_preferences as preference
where history.alert_preference_id = preference.id
  and history.matched_keyword is null;

update public.alert_history
set matched_keyword = '[legacy unknown]'
where matched_keyword is null;

alter table public.alert_history
  alter column matched_keyword set not null;
