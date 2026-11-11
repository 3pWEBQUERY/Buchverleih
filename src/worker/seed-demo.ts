/**
 * Demo-Bestand für die Beta: 20 Mitglieder mit Regalen voller echter Bücher.
 *
 * Es werden keine ISBNs geraten. Für jeden Titel sucht der Worker über Google Books eine
 * real existierende Ausgabe und legt sie über den normalen Katalogweg an (DNB/Google, Originalcover).
 * Titel ohne Treffer werden übersprungen. Läuft idempotent: ein zweiter Lauf ändert nichts.
 *
 * Erkennbar und entfernbar: Alle Demo-Konten haben eine Adresse unter @demo.leihregal.invalid
 * (nicht zustellbar, kann sich nicht anmelden). Entfernen mit dem Job «remove_demo».
 */
import type postgres from "postgres";
import { env } from "@/lib/env";
import { homeFromPlz } from "@/lib/geo";
import { editionByIsbn } from "@/lib/catalog/works";

type Sql = postgres.Sql;
export const DEMO_DOMAIN = "demo.leihregal.invalid";

/** Vorname, PLZ, Vertrauensstufe */
const PEOPLE: [string, string, number][] = [
  ["Sandro", "8180", 1], ["Fabienne", "8180", 2], ["Reto", "8184", 1], ["Nicole", "8185", 0], ["Simon", "8302", 1],
  ["Laura", "8303", 0], ["Matteo", "8152", 1], ["Chiara", "8304", 2], ["Lukas", "8193", 0], ["Selina", "8424", 1],
  ["Thomas", "8050", 2], ["Martina", "8006", 1], ["Patrick", "8057", 0], ["Rahel", "8037", 1], ["David", "8004", 2],
  ["Andrea", "8600", 1], ["Yannick", "8400", 0], ["Leonie", "8155", 1], ["Nicola", "8172", 0], ["Sophie", "8032", 1],
];

/** Echte Titel: Titel, Autorin oder Autor, Genre, Sprache der gesuchten Ausgabe */
const TITLES: [string, string, string, "de" | "en"][] = [
  // Schweiz
  ["Small World", "Martin Suter", "Roman", "de"], ["Die dunkle Seite des Mondes", "Martin Suter", "Roman", "de"],
  ["Allmen und die Libellen", "Martin Suter", "Krimi", "de"], ["Elefant", "Martin Suter", "Roman", "de"],
  ["Agnes", "Peter Stamm", "Roman", "de"], ["Weit über das Land", "Peter Stamm", "Roman", "de"],
  ["Léon und Louise", "Alex Capus", "Roman", "de"], ["Königskinder", "Alex Capus", "Roman", "de"],
  ["Melnitz", "Charles Lewinsky", "Roman", "de"], ["Der Halbbart", "Charles Lewinsky", "Roman", "de"],
  ["Koala", "Lukas Bärfuss", "Roman", "de"], ["Tauben fliegen auf", "Melinda Nadj Abonji", "Roman", "de"],
  ["Blutbuch", "Kim de l'Horizon", "Roman", "de"], ["Faserland", "Christian Kracht", "Roman", "de"],
  ["Eurotrash", "Christian Kracht", "Roman", "de"], ["Imperium", "Christian Kracht", "Roman", "de"],
  ["Die Wahrheit über den Fall Harry Quebert", "Joël Dicker", "Krimi", "de"], ["Der Verdacht", "Friedrich Dürrenmatt", "Krimi", "de"],
  ["Das Versprechen", "Friedrich Dürrenmatt", "Krimi", "de"], ["Mein Name sei Gantenbein", "Max Frisch", "Roman", "de"],
  ["Andorra", "Max Frisch", "Drama", "de"], ["Der Gehülfe", "Robert Walser", "Roman", "de"],
  ["Wachtmeister Studer", "Friedrich Glauser", "Krimi", "de"], ["Die Kunst des klaren Denkens", "Rolf Dobelli", "Sachbuch", "de"],
  ["Schellen-Ursli", "Selina Chönz", "Kinderbuch", "de"], ["Der grosse Kater", "Thomas Hürlimann", "Roman", "de"],
  // Gegenwart
  ["Der Vorleser", "Bernhard Schlink", "Roman", "de"], ["Das Parfum", "Patrick Süskind", "Roman", "de"],
  ["Der Schwarm", "Frank Schätzing", "Roman", "de"], ["Tschick", "Wolfgang Herrndorf", "Jugendbuch", "de"],
  ["Die Vermessung der Welt", "Daniel Kehlmann", "Roman", "de"], ["Tyll", "Daniel Kehlmann", "Roman", "de"],
  ["Altes Land", "Dörte Hansen", "Roman", "de"], ["Unterleuten", "Juli Zeh", "Roman", "de"],
  ["Über Menschen", "Juli Zeh", "Roman", "de"], ["Herkunft", "Saša Stanišić", "Roman", "de"],
  ["Der Trafikant", "Robert Seethaler", "Roman", "de"], ["Ein ganzes Leben", "Robert Seethaler", "Roman", "de"],
  ["Was man von hier aus sehen kann", "Mariana Leky", "Roman", "de"], ["Vom Ende der Einsamkeit", "Benedict Wells", "Roman", "de"],
  ["Hard Land", "Benedict Wells", "Roman", "de"], ["Kairos", "Jenny Erpenbeck", "Roman", "de"],
  ["Die Mittagsfrau", "Julia Franck", "Roman", "de"], ["Kruso", "Lutz Seiler", "Roman", "de"],
  ["Der Turm", "Uwe Tellkamp", "Roman", "de"], ["Die Blechtrommel", "Günter Grass", "Roman", "de"],
  ["Im Westen nichts Neues", "Erich Maria Remarque", "Roman", "de"], ["Der Hals der Giraffe", "Judith Schalansky", "Roman", "de"],
  // Übersetzungen
  ["Der Name der Rose", "Umberto Eco", "Roman", "de"], ["Hundert Jahre Einsamkeit", "Gabriel García Márquez", "Roman", "de"],
  ["Die Liebe in den Zeiten der Cholera", "Gabriel García Márquez", "Roman", "de"], ["1984", "George Orwell", "Roman", "de"],
  ["Farm der Tiere", "George Orwell", "Roman", "de"], ["Schöne neue Welt", "Aldous Huxley", "Roman", "de"],
  ["Der Fänger im Roggen", "J. D. Salinger", "Roman", "de"], ["Wer die Nachtigall stört", "Harper Lee", "Roman", "de"],
  ["Der große Gatsby", "F. Scott Fitzgerald", "Roman", "de"], ["Die Pest", "Albert Camus", "Roman", "de"],
  ["Der Fremde", "Albert Camus", "Roman", "de"], ["Der Alchimist", "Paulo Coelho", "Roman", "de"],
  ["Drachenläufer", "Khaled Hosseini", "Roman", "de"], ["Der Schatten des Windes", "Carlos Ruiz Zafón", "Roman", "de"],
  ["Die Bücherdiebin", "Markus Zusak", "Roman", "de"], ["Normale Menschen", "Sally Rooney", "Roman", "de"],
  ["Die Mitternachtsbibliothek", "Matt Haig", "Roman", "de"], ["Der Gesang der Flusskrebse", "Delia Owens", "Roman", "de"],
  ["Die Säulen der Erde", "Ken Follett", "Roman", "de"], ["Der Hundertjährige, der aus dem Fenster stieg und verschwand", "Jonas Jonasson", "Roman", "de"],
  ["Anna Karenina", "Lew Tolstoi", "Roman", "de"], ["Schuld und Sühne", "Fjodor Dostojewski", "Roman", "de"],
  ["Der Meister und Margarita", "Michail Bulgakow", "Roman", "de"], ["Stolz und Vorurteil", "Jane Austen", "Roman", "de"],
  ["Die Glasglocke", "Sylvia Plath", "Roman", "de"], ["Meine geniale Freundin", "Elena Ferrante", "Roman", "de"],
  // Krimi
  ["Die Therapie", "Sebastian Fitzek", "Krimi", "de"], ["Der Insasse", "Sebastian Fitzek", "Krimi", "de"],
  ["Verblendung", "Stieg Larsson", "Krimi", "de"], ["Mord im Orientexpress", "Agatha Christie", "Krimi", "de"],
  ["Venezianisches Finale", "Donna Leon", "Krimi", "de"], ["Der Hund von Baskerville", "Arthur Conan Doyle", "Krimi", "de"],
  // Kinder und Jugend
  ["Harry Potter und der Stein der Weisen", "J. K. Rowling", "Jugendbuch", "de"], ["Der Hobbit", "J. R. R. Tolkien", "Fantasy", "de"],
  ["Die unendliche Geschichte", "Michael Ende", "Fantasy", "de"], ["Momo", "Michael Ende", "Jugendbuch", "de"],
  ["Tintenherz", "Cornelia Funke", "Jugendbuch", "de"], ["Pippi Langstrumpf", "Astrid Lindgren", "Kinderbuch", "de"],
  ["Die Brüder Löwenherz", "Astrid Lindgren", "Kinderbuch", "de"], ["Emil und die Detektive", "Erich Kästner", "Kinderbuch", "de"],
  ["Das doppelte Lottchen", "Erich Kästner", "Kinderbuch", "de"], ["Der kleine Prinz", "Antoine de Saint-Exupéry", "Kinderbuch", "de"],
  ["Die kleine Hexe", "Otfried Preußler", "Kinderbuch", "de"], ["Krabat", "Otfried Preußler", "Jugendbuch", "de"],
  // Sachbuch
  ["Eine kurze Geschichte der Menschheit", "Yuval Noah Harari", "Sachbuch", "de"], ["Eine kurze Geschichte der Zeit", "Stephen Hawking", "Sachbuch", "de"],
  ["Schnelles Denken, langsames Denken", "Daniel Kahneman", "Sachbuch", "de"], ["Factfulness", "Hans Rosling", "Sachbuch", "de"],
  ["Das geheime Leben der Bäume", "Peter Wohlleben", "Sachbuch", "de"], ["Darm mit Charme", "Giulia Enders", "Sachbuch", "de"],
  ["Becoming", "Michelle Obama", "Biografie", "de"], ["Die Welt von Gestern", "Stefan Zweig", "Biografie", "de"],
  // Englisch
  ["Normal People", "Sally Rooney", "Roman", "en"], ["The Remains of the Day", "Kazuo Ishiguro", "Roman", "en"],
  ["Never Let Me Go", "Kazuo Ishiguro", "Roman", "en"], ["The Road", "Cormac McCarthy", "Roman", "en"],
  ["Atonement", "Ian McEwan", "Roman", "en"], ["The Handmaid's Tale", "Margaret Atwood", "Roman", "en"],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sucht über Google Books eine real existierende Ausgabe (ISBN-13) zu Titel und Autor. */
async function findIsbn(title: string, author: string, lang: "de" | "en"): Promise<string | null> {
  const last = author.split(" ").pop()!;
  const q = `intitle:${title} inauthor:${last}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&maxResults=10&langRestrict=${lang}${env.googleBooksKey ? `&key=${env.googleBooksKey}` : ""}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { items?: { volumeInfo?: { title?: string; authors?: string[]; industryIdentifiers?: { type: string; identifier: string }[]; imageLinks?: unknown } }[] };
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    // Bevorzugt: Titel passt, Autor passt, ISBN-13, mit Cover
    const items = (d.items ?? []).filter((it) => {
      const v = it.volumeInfo ?? {};
      return v.title && norm(v.title).includes(norm(title).slice(0, 12)) && (v.authors ?? []).some((a) => norm(a).includes(norm(last)))
        && (v.industryIdentifiers ?? []).some((i) => i.type === "ISBN_13" && /^97[89]\d{10}$/.test(i.identifier));
    });
    items.sort((a, b) => Number(Boolean(b.volumeInfo?.imageLinks)) - Number(Boolean(a.volumeInfo?.imageLinks)));
    const id = items[0]?.volumeInfo?.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier;
    return id ?? null;
  } catch {
    return null;
  }
}

export async function seedDemo(sql: Sql) {
  // 1. Mitglieder
  const ids: string[] = [];
  for (const [i, [name, plz, trust]] of PEOPLE.entries()) {
    const email = `${name.toLowerCase()}@${DEMO_DOMAIN}`;
    const [existing] = await sql<{ id: string }[]>`select id from users where lower(email) = ${email}`;
    if (existing) { ids.push(existing.id); continue; }
    const [p] = await sql<{ lat: number; lng: number; municipality: string }[]>`select lat, lng, municipality from postal_codes where plz = ${plz}`;
    if (!p) continue;
    const { home, display } = homeFromPlz(p.lat, p.lng);
    const [u] = await sql<{ id: string }[]>`
      insert into users (email, email_verified_at, first_name, plz, municipality, home_lat, home_lng, display_lat, display_lng,
                         trust_level, onboarded_at, age_confirmed_at, created_at)
      values (${email}, now(), ${name}, ${plz}, ${p.municipality}, ${home.lat}, ${home.lng}, ${display.lat}, ${display.lng},
              ${trust}, now(), now(), now() - make_interval(days => ${20 + i * 7}))
      returning id`;
    ids.push(u.id);
  }
  if (!ids.length) return { users: 0, books: 0 };

  // 2. Bücher: nur, was die Kataloge kennen
  const [{ n: already }] = await sql<{ n: number }[]>`
    select count(*)::int as n from copies c join users u on u.id = c.owner_id where u.email like ${"%@" + DEMO_DOMAIN}`;
  if (already >= 40) return { users: ids.length, books: already };

  let made = 0;
  let missing = 0;
  for (const [i, [title, author, genre, lang]] of TITLES.entries()) {
    const isbn = await findIsbn(title, author, lang);
    await sleep(250);
    if (!isbn) { missing++; continue; }
    let edition;
    try {
      edition = await editionByIsbn(isbn);
    } catch {
      edition = null;
    }
    if (!edition) { missing++; continue; }
    await sql`update works set genre = coalesce(genre, ${genre}) where id = ${edition.work_id}`;
    // Ein bis zwei Exemplare pro Titel, verteilt auf die Regale
    const owners = [ids[(i * 7) % ids.length], ...(i % 5 === 0 ? [ids[(i * 7 + 9) % ids.length]] : [])];
    for (const [k, owner] of owners.entries()) {
      const offers = i % 9 === 0 ? "{lend,swap}" : i % 17 === 0 ? "{gift}" : i % 13 === 0 ? "{swap}" : "{lend}";
      await sql`
        insert into copies (owner_id, edition_id, condition, offers, created_at)
        values (${owner}, ${edition.id}, ${((i + k) % 3) + 1}, ${offers}::offer_kind[], now() - make_interval(hours => ${(i * 13 + k * 5) % 1400}))`;
      made++;
    }
    await sleep(150);
  }

  // 3. Übergabeorte und ein zweiter Kreis
  const spots: [number, string, string][] = [
    [0, "Bahnhof Bülach, beim Kiosk", "Unterführung, Seite Altstadt"], [4, "Bahnhof Kloten, Haupteingang", "Neben dem Billettautomaten"],
    [6, "Glattpark, Bibliothek Opfikon", "Eingang Seite Park"], [10, "Bahnhof Oerlikon, Gleis 1", "Beim Café"],
    [14, "Pestalozzi-Bibliothek Hardau", "Im Foyer"], [16, "Winterthur, Stadtbibliothek", "Beim Rückgabeautomaten"],
  ];
  for (const [i, label, detail] of spots) {
    if (!ids[i]) continue;
    await sql`insert into pickup_spots (user_id, label, detail, dropoff)
              select ${ids[i]}, ${label}, ${detail}, false where not exists (select 1 from pickup_spots where user_id = ${ids[i]})`;
  }
  const [circle] = await sql<{ id: string }[]>`
    insert into circles (name, description, loan_days, auto_accept, fixed_spot, invite_code, created_by)
    values ('Bücherfreunde Unterland', 'Wir tauschen und leihen zwischen Bülach, Kloten und Embrach. Neue sind willkommen.', 42, false, null, 'unterland-demo', ${ids[0]})
    on conflict do nothing returning id`;
  if (circle) {
    for (const uid of [0, 1, 2, 3, 4, 9].map((i) => ids[i]).filter(Boolean)) {
      await sql`insert into circle_members (circle_id, user_id, role) values (${circle.id}, ${uid}, ${uid === ids[0] ? "admin" : "member"}) on conflict do nothing`;
    }
    await sql`insert into circle_copies (circle_id, copy_id)
              select ${circle.id}, c.id from copies c where c.owner_id in ${sql([0, 1, 2, 3, 4, 9].map((i) => ids[i]).filter(Boolean))}
              order by c.created_at desc limit 16 on conflict do nothing`;
  }
  console.log(`[demo] ${ids.length} Mitglieder, ${made} Exemplare angelegt, ${missing} Titel ohne Katalogtreffer übersprungen`);
  return { users: ids.length, books: made, missing };
}

/** Demo-Bestand wieder entfernen: Bücher aus den Regalen, Konten wie bei einer Löschung anonymisiert. */
export async function removeDemo(sql: Sql) {
  const like = `%@${DEMO_DOMAIN}`;
  await sql`update copies set removed_at = coalesce(removed_at, now()), removed_reason = coalesce(removed_reason, 'deleted')
             where owner_id in (select id from users where email like ${like})`;
  await sql`update loans set circle_id = null where circle_id in (select id from circles where invite_code = 'unterland-demo')`;
  await sql`delete from circles where invite_code = 'unterland-demo'`;
  await sql`delete from pickup_spots where user_id in (select id from users where email like ${like})`;
  await sql`update users set first_name = 'Ehemaliges Mitglied', deleted_at = coalesce(deleted_at, now()),
                    home_lat = null, home_lng = null, display_lat = null, display_lng = null
             where email like ${like}`;
  console.log("[demo] Demo-Bestand entfernt");
}
