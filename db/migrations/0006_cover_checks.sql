-- Merker, wann zuletzt nach einem Original-Cover gesucht wurde (verhindert Dauerschleifen)
alter table editions add column if not exists cover_checked_at timestamptz;
