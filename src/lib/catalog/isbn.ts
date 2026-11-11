/** ISBN-10 und ISBN-13 prüfen und auf ISBN-13 normalisieren. */
export function normalizeIsbn(input: string): string | null {
  const s = input.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (s.length === 13 && /^97[89]\d{10}$/.test(s)) return isbn13Valid(s) ? s : null;
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    if (!isbn10Valid(s)) return null;
    const core = "978" + s.slice(0, 9);
    return core + isbn13Check(core);
  }
  return null;
}

function isbn10Valid(s: string) {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === "X" ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}

function isbn13Check(core12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

function isbn13Valid(s: string) {
  return isbn13Check(s.slice(0, 12)) === s[12];
}

export function formatIsbn(s: string) {
  return s.length === 13 ? `${s.slice(0, 3)}-${s.slice(3, 4)}-${s.slice(4, 9)}-${s.slice(9, 12)}-${s[12]}` : s;
}
