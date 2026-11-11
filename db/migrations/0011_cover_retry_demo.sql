-- Fehlende Cover sofort erneut versuchen (statt nach 7 Tagen), z. B. für den Demo-Bestand.
update editions set cover_checked_at = null where cover_key is null and isbn13 is not null;
