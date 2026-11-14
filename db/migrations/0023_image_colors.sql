-- Dominante Farbe pro Bild (#rrggbb): Hintergrund, bis das Cover geladen ist.
-- Der Worker bestimmt sie beim Verarbeiten (sharp); bestehende Bilder holt ein Hintergrundjob nach.
alter table editions    add column cover_color text check (cover_color ~ '^#[0-9a-f]{6}$');
alter table copy_photos add column color       text check (color ~ '^#[0-9a-f]{6}$');
alter table uploads     add column color       text check (color ~ '^#[0-9a-f]{6}$');

-- Nachtrag für bestehende Bilder in kleinen Schritten über die Warteschlange (blockiert keinen Start).
insert into jobs (kind, payload) values ('backfill_image_colors', '{}'::jsonb);
