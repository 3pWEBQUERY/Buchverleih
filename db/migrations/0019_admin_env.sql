-- Admin-Rolle aus ADMIN_EMAILS merken, damit sie beim Entfernen aus der Liste wieder entzogen wird.
-- Admins, die auf anderem Weg entstanden (SQL, Seed), behalten false und bleiben unberührt.
alter table users add column admin_via_env boolean not null default false;
