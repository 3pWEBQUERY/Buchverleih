-- Die drei Zahlen auf dem Profil (PRD 4.7) und die Vertrauensstufe.

create or replace view user_stats as
select
  u.id as user_id,
  (select count(*) from loans l
     where l.owner_id = u.id and l.kind = 'lend' and l.status = 'completed') as lent_count,
  (select count(*) from loans l
     where l.borrower_id = u.id and l.kind = 'lend' and l.status = 'completed') as borrowed_count,
  (select count(*) from loans l
     where l.borrower_id = u.id and l.kind = 'lend' and l.status = 'completed' and not l.late) as punctual_count,
  (select count(*) from loans l
     where l.borrower_id = u.id and l.kind = 'lend'
       and (l.status in ('completed', 'lost') or (l.status = 'cancelled' and l.cancelled_late))) as rated_count,
  (select count(*) from cases c join loans l on l.id = c.loan_id
     where l.borrower_id = u.id and c.outcome = 'lost' and c.cleared_at is null
       and c.closed_at > now() - interval '24 months') as visible_losses,
  (select count(*) from loans l
     where l.owner_id = u.id and l.cancelled_by = u.id and l.cancelled_late) as owner_late_cancels,
  (select percentile_cont(0.5) within group (order by extract(epoch from (e.created_at - l.requested_at)))
     from loans l join loan_events e on e.loan_id = l.id and e.action in ('accept', 'decline')
    where l.owner_id = u.id and l.requested_at > now() - interval '180 days') as median_response_seconds
from users u;

create or replace function recompute_trust(uid uuid) returns smallint language plpgsql as $$
declare
  done_count int;
  last3_late int;
  lost_12m int;
  lvl smallint := 0;
begin
  select count(*) into done_count from loans
   where borrower_id = uid and kind = 'lend' and status = 'completed';

  select count(*) filter (where late) into last3_late from (
    select late from loans
     where borrower_id = uid and kind = 'lend' and status = 'completed'
     order by closed_at desc limit 3) t;

  select count(*) into lost_12m from cases c join loans l on l.id = c.loan_id
   where l.borrower_id = uid and c.outcome = 'lost' and c.cleared_at is null
     and c.closed_at > now() - interval '12 months';

  if done_count >= 10 and lost_12m = 0 then
    lvl := 2;
  elsif done_count >= 3 and last3_late = 0 and lost_12m = 0 then
    lvl := 1;
  end if;

  update users set trust_level = lvl where id = uid and trust_level <> lvl;
  return lvl;
end $$;

-- Gemeinsamer Kreis zweier Mitglieder, in dem ein Exemplar sichtbar ist
create or replace function shared_circle_for_copy(viewer uuid, copy uuid) returns uuid language sql stable as $$
  select cc.circle_id
    from circle_copies cc
    join circle_members m on m.circle_id = cc.circle_id and m.user_id = viewer and m.status = 'active'
   where cc.copy_id = copy
   limit 1
$$;

-- Ist das Exemplar für dieses Mitglied sichtbar? (Sichtbarkeit, Blockierungen, Sperren)
create or replace function copy_visible_to(copy uuid, viewer uuid) returns boolean language sql stable as $$
  select exists (
    select 1
      from copies c
      join users o on o.id = c.owner_id and o.deleted_at is null and o.banned_at is null
     where c.id = copy and c.removed_at is null
       and (
         c.owner_id = viewer
         or (
           (viewer is null or not exists (
              select 1 from blocks b
               where (b.blocker_id = c.owner_id and b.blocked_id = viewer)
                  or (b.blocker_id = viewer and b.blocked_id = c.owner_id)))
           and (
             c.visibility = 'all'
             or (c.visibility = 'proven' and viewer is not null and (
                   (select trust_level from users where id = viewer) >= 1
                   or shared_circle_for_copy(viewer, c.id) is not null))
             or (c.visibility = 'circles' and viewer is not null and shared_circle_for_copy(viewer, c.id) is not null)
           )
         )
       )
  )
$$;
