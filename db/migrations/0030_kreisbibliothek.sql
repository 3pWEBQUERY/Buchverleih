-- Kreis-Regal mit eigenem Bestand (PRD 7.5, Phase 2): Bücher, die dem Kreis gehören.
-- owner_id ist die betreuende Admin-Person (Übergaben, Anfragen); library_circle_id der Kreis, dem das Buch gehört.
alter table copies add column library_circle_id uuid references circles (id) on delete set null;
create index on copies (library_circle_id) where library_circle_id is not null;

-- Rückgabe über die Ablage (PRD 4.3): Foto der abgelegten Rückgabe, 48 h Einspruch wie bei der Meldung
alter table loans add column return_photo_key text;
