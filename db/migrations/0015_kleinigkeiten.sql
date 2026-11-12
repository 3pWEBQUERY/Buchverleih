-- Gemeinsamer Kreis zu einem Exemplar: bei mehreren Kreisen immer derselbe (längste Mitgliedschaft, dann Id)
create or replace function shared_circle_for_copy(viewer uuid, copy uuid) returns uuid language sql stable as $$
  select cc.circle_id
    from circle_copies cc
    join circle_members m on m.circle_id = cc.circle_id and m.user_id = viewer and m.status = 'active'
   where cc.copy_id = copy
   order by m.joined_at, cc.circle_id
   limit 1
$$;

-- Demo-Kreis: Einladecode nicht erratbar
update circles set invite_code = 'demo-' || substr(md5(random()::text || id::text), 1, 12)
 where invite_code = 'unterland-demo';
