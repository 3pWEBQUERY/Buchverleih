/**
 * Beispieldaten für lokale Entwicklung und Staging. Nie in Produktion ausführen:
 * die Startseite zeigt echten Bestand, und erfundene Mitglieder wären irreführend.
 *   SEED_CONFIRM=yes npm run seed
 */
import postgres from "postgres";
import { homeFromPlz } from "../src/lib/geo";

if (process.env.SEED_CONFIRM !== "yes") {
  console.error("Abbruch: SEED_CONFIRM=yes setzen. Nur für Entwicklung und Staging.");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

const people: [string, string, number, string][] = [
  ["Marc", "8180", 2, "marc@beispiel.ch"],
  ["Lea", "8180", 1, "lea@beispiel.ch"],
  ["Jonas", "8184", 1, "jonas@beispiel.ch"],
  ["Anna", "8185", 0, "anna@beispiel.ch"],
  ["Samira", "8302", 2, "samira@beispiel.ch"],
  ["Luca", "8152", 0, "luca@beispiel.ch"],
  ["Mirjam", "8006", 1, "mirjam@beispiel.ch"],
  ["Beat", "8037", 2, "beat@beispiel.ch"],
  ["Noemi", "8004", 0, "noemi@beispiel.ch"],
  ["Elif", "8050", 1, "elif@beispiel.ch"],
];

const books: [title: string, author: string, lang: string, genre: string, year: number][] = [
  ["Der Process", "Franz Kafka", "de", "Roman", 1925],
  ["Homo faber", "Max Frisch", "de", "Roman", 1957],
  ["Stiller", "Max Frisch", "de", "Roman", 1954],
  ["Der Richter und sein Henker", "Friedrich Dürrenmatt", "de", "Krimi", 1952],
  ["Die Physiker", "Friedrich Dürrenmatt", "de", "Roman", 1962],
  ["Der Besuch der alten Dame", "Friedrich Dürrenmatt", "de", "Roman", 1956],
  ["Heidi", "Johanna Spyri", "de", "Kinderbuch", 1880],
  ["Der Steppenwolf", "Hermann Hesse", "de", "Roman", 1927],
  ["Siddhartha", "Hermann Hesse", "de", "Roman", 1922],
  ["Unterm Rad", "Hermann Hesse", "de", "Roman", 1906],
  ["Effi Briest", "Theodor Fontane", "de", "Roman", 1895],
  ["Der Zauberberg", "Thomas Mann", "de", "Roman", 1924],
  ["Buddenbrooks", "Thomas Mann", "de", "Roman", 1901],
  ["Die Verwandlung", "Franz Kafka", "de", "Roman", 1915],
  ["Faust. Eine Tragödie", "Johann Wolfgang von Goethe", "de", "Lyrik", 1808],
  ["Der grüne Heinrich", "Gottfried Keller", "de", "Roman", 1855],
  ["Kleider machen Leute", "Gottfried Keller", "de", "Roman", 1874],
  ["Die Wand", "Marlen Haushofer", "de", "Roman", 1963],
  ["Momo", "Michael Ende", "de", "Jugendbuch", 1973],
  ["Die unendliche Geschichte", "Michael Ende", "de", "Fantasy", 1979],
  ["Pride and Prejudice", "Jane Austen", "en", "Roman", 1813],
  ["Middlemarch", "George Eliot", "en", "Roman", 1871],
  ["Frankenstein", "Mary Shelley", "en", "Roman", 1818],
  ["Madame Bovary", "Gustave Flaubert", "fr", "Roman", 1857],
  ["Le Petit Prince", "Antoine de Saint-Exupéry", "fr", "Kinderbuch", 1943],
  ["Il Gattopardo", "Giuseppe Tomasi di Lampedusa", "it", "Roman", 1958],
  ["Der Untertan", "Heinrich Mann", "de", "Roman", 1918],
  ["Schachnovelle", "Stefan Zweig", "de", "Roman", 1942],
  ["Die Welt von Gestern", "Stefan Zweig", "de", "Biografie", 1942],
  ["Berlin Alexanderplatz", "Alfred Döblin", "de", "Roman", 1929],
  ["Der Mann ohne Eigenschaften", "Robert Musil", "de", "Roman", 1930],
  ["Die Leiden des jungen Werther", "Johann Wolfgang von Goethe", "de", "Roman", 1774],
  ["Woyzeck", "Georg Büchner", "de", "Roman", 1879],
  ["Wilhelm Tell", "Friedrich Schiller", "de", "Roman", 1804],
  ["Die Elixiere des Teufels", "E. T. A. Hoffmann", "de", "Roman", 1815],
  ["Der Schimmelreiter", "Theodor Storm", "de", "Roman", 1888],
];

function key(t: string, a: string) {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return `${n(t)}|${n(a).split(" ").pop()}`;
}

async function main() {
  const ids: string[] = [];
  for (const [name, plz, trust, email] of people) {
    const [p] = await sql<{ lat: number; lng: number; municipality: string }[]>`select lat, lng, municipality from postal_codes where plz = ${plz}`;
    const { home, display } = homeFromPlz(p.lat, p.lng);
    const [u] = await sql<{ id: string }[]>`
      insert into users (email, email_verified_at, phone_e164, phone_verified_at, first_name, plz, municipality, home_lat, home_lng,
                         display_lat, display_lng, trust_level, onboarded_at, age_confirmed_at, created_at)
      values (${email}, now(), ${"+4179" + String(5550000 + ids.length)}, now(), ${name}, ${plz}, ${p.municipality},
              ${home.lat}, ${home.lng}, ${display.lat}, ${display.lng}, ${trust}, now(), now(), now() - make_interval(days => ${30 + ids.length * 17}))
      on conflict do nothing returning id`;
    if (!u) {
      const [ex] = await sql<{ id: string }[]>`select id from users where lower(email) = ${email}`;
      ids.push(ex.id);
    } else ids.push(u.id);
  }
  await sql`update users set role = 'admin' where email = 'marc@beispiel.ch'`;

  let i = 0;
  for (const [title, author, lang, genre, year] of books) {
    const [w] = await sql<{ id: string }[]>`
      insert into works (work_key, title, authors, original_language, genre) values (${key(title, author)}, ${title}, ${[author]}::text[], ${lang}, ${genre})
      on conflict (work_key) do update set genre = excluded.genre returning id`;
    const [e] = await sql<{ id: string }[]>`
      insert into editions (work_id, title, year, language, source, binding) values (${w.id}, ${title}, ${year}, ${lang}, 'manual', ${i % 3 ? "paperback" : "hardcover"})
      returning id`;
    const owners = [ids[i % ids.length], ...(i % 4 === 0 ? [ids[(i + 3) % ids.length]] : [])];
    for (const owner of owners) {
      const offers = i % 7 === 0 ? "{lend,swap}" : i % 11 === 0 ? "{gift}" : "{lend}";
      await sql`insert into copies (owner_id, edition_id, condition, offers, created_at)
                values (${owner}, ${e.id}, ${(i % 4) + 1}, ${offers}::offer_kind[], now() - make_interval(hours => ${i * 9}))`;
    }
    i++;
  }

  await sql`insert into pickup_spots (user_id, label, detail, dropoff) values
    (${ids[0]}, 'Bahnhof Bülach, Kiosk', 'Beim Kiosk auf Gleis 1', false),
    (${ids[0]}, 'Bei mir, Milchkasten', 'Gartenweg, Milchkasten mit grünem Deckel', true),
    (${ids[1]}, 'Stadtbibliothek Bülach, Eingang', null, false)`;

  const [c] = await sql<{ id: string }[]>`
    insert into circles (name, description, loan_days, auto_accept, fixed_spot, invite_code, created_by)
    values ('Lesekreis Bülach', 'Wir lesen jeden Monat ein Buch und treffen uns im Kulturhaus.', 56, true, 'Regal im Kulturhaus', 'lesekreis26', ${ids[0]})
    on conflict do nothing returning id`;
  if (c) {
    for (const uid of ids.slice(0, 4)) {
      await sql`insert into circle_members (circle_id, user_id, role) values (${c.id}, ${uid}, ${uid === ids[0] ? "admin" : "member"}) on conflict do nothing`;
    }
    await sql`insert into circle_copies (circle_id, copy_id) select ${c.id}, id from copies where owner_id in ${sql(ids.slice(0, 4))} limit 10 on conflict do nothing`;
  }
  console.log(`Beispieldaten: ${ids.length} Mitglieder, ${books.length} Werke. Anmelden z. B. mit marc@beispiel.ch (Admin).`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
