import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/leihregal_test";
  execSync(`psql "${url}" -q -c "drop schema public cascade; create schema public;"`, { stdio: "inherit" });
  execSync("npx tsx scripts/migrate.ts", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
