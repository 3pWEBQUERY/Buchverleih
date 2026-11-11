-- Google Books jetzt mit API-Schlüssel: Ausgaben ohne Cover erneut prüfen
update editions set cover_checked_at = null where cover_key is null;
