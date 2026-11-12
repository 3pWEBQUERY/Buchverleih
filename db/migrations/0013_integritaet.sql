-- Übergabeorte lassen sich löschen, auch wenn ein abgeschlossener Vorgang sie einmal benutzt hat
-- (sonst scheitert die Kontolöschung). Offene Vorgänge schützt die Anwendung.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'loans'::regclass and contype = 'f'
     and conkey = array[(select attnum from pg_attribute where attrelid = 'loans'::regclass and attname = 'pickup_spot_id')];
  if c is not null then execute format('alter table loans drop constraint %I', c); end if;
end $$;
alter table loans add constraint loans_pickup_spot_id_fkey foreign key (pickup_spot_id) references pickup_spots (id) on delete set null;

-- Demo-Konten erkennbar machen: sie nehmen keine Anfragen an und lösen keine Titelalarme aus
alter table users add column if not exists is_demo boolean generated always as (email like '%@demo.leihregal.invalid') stored;
