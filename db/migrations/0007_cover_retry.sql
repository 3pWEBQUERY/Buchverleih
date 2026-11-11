-- Neue Cover-Quelle (DNB): Ausgaben ohne Cover sofort erneut prüfen
update editions set cover_checked_at = null where cover_key is null;
