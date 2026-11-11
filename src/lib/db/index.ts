import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __leihregalSql: postgres.Sql | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt");
  return postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 30,
    connect_timeout: 10,
    // Kalendertage bleiben Text (YYYY-MM-DD), damit keine Zeitzone sie verschiebt.
    // daterange kommt ohnehin als Text zurück, z. B. «[2026-11-12,2026-12-10)».
    types: {
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
    transform: { undefined: null },
    onnotice: () => {},
  });
}

/** Eine gemeinsame Verbindung pro Prozess (auch über Hot-Reload hinweg). */
export const sql: postgres.Sql = globalThis.__leihregalSql ?? (globalThis.__leihregalSql = create());

export type Tx = postgres.TransactionSql | postgres.Sql;

/** Postgres-Fehlercodes, die fachlich bedeutsam sind (PRD 9.2). */
export const PG = {
  EXCLUSION: "23P01",   // Zeitraum im Kalender belegt
  UNIQUE: "23505",      // doppelte Anfrage
  CHECK: "23514",       // z. B. «aktiv» ohne Übergabezeitpunkt
} as const;

export function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : undefined;
}
