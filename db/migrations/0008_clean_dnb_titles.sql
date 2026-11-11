-- DNB-Titel mit vorangestelltem Originaltitel bereinigen: «[The Last Daughter] ; Die verschwiegene Tochter»
update works set title = btrim(regexp_replace(title, '^\s*\[[^\]]*\]\s*[;:.]?\s*', ''))
 where title ~ '^\s*\[[^\]]*\]';
update editions set title = btrim(regexp_replace(title, '^\s*\[[^\]]*\]\s*[;:.]?\s*', ''))
 where title ~ '^\s*\[[^\]]*\]';
