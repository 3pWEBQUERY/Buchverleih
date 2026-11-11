import { cx } from "./ui";

/**
 * Cover (PRD 8.1): immer im echten Seitenverhältnis, nie beschnitten, mit feiner Kante.
 * Ohne frei nutzbares Cover entsteht ein typografisches Ersatzcover aus Titel und Autor
 * (PRD 7.2) – in Farben von Buchleinen. Die Cover sind die Farbe der Oberfläche.
 */
const CLOTH: [bg: string, fg: string][] = [
  ["#6d2b2a", "#f3e7d3"],
  ["#2e4a3b", "#eee4cc"],
  ["#22324a", "#efe6d2"],
  ["#a8822e", "#1f1b12"],
  ["#9e4c2f", "#f6ead8"],
  ["#55624a", "#f0e9d6"],
  ["#4b2e44", "#f1e4d8"],
  ["#2b5a5b", "#eef0e4"],
  ["#3c3a35", "#e9dfc9"],
  ["#c79b45", "#1d1a12"],
  ["#7a3b2e", "#f4e8d6"],
  ["#384a6b", "#eee6d6"],
  ["#e5dbc4", "#2a241b"],
  ["#d3c19b", "#2a241b"],
  ["#1f2a26", "#d9c98f"],
  ["#8c2f39", "#f3e3cf"],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type CoverData = {
  title: string;
  authors?: string[];
  photoKey?: string | null;
  photoW?: number | null;
  photoH?: number | null;
  coverKey?: string | null;
  seed?: string;
};

export function coverRatio(c: CoverData) {
  if (c.photoKey && c.photoW && c.photoH) return c.photoW / c.photoH;
  const h = hash(c.seed ?? c.title);
  return 0.64 + ((h % 7) / 100); // 0.64–0.70: Taschenbuch bis gebunden
}

export function imageUrl(key: string, small = true) {
  return `/api/v1/images/${key}${small ? "?w=480" : ""}`;
}

export function Cover({
  data, height, width, className, large = false, priority = false,
}: { data: CoverData; height?: number; width?: number; className?: string; large?: boolean; priority?: boolean }) {
  const ratio = coverRatio(data);
  const h = height ?? (width ? Math.round(width / ratio) : 180);
  const w = width ?? Math.round(h * ratio);
  const author = data.authors?.[0] ?? "";
  const alt = author ? `${data.title} von ${author}` : data.title;
  const key = data.photoKey ?? data.coverKey;

  if (key) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl(key, !large)}
        alt={alt}
        width={w}
        height={h}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cx("block bg-paper-3 object-contain outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10 rounded-xs", className)}
        style={{ width: w, height: h, aspectRatio: `${w} / ${h}` }}
      />
    );
  }

  const [bg, fg] = CLOTH[hash(data.seed ?? data.title + author) % CLOTH.length];
  const len = data.title.length;
  const scale = large ? 1.9 : 1;
  const size = (len < 12 ? 17 : len < 24 ? 15 : len < 40 ? 13 : 11.5) * (w / 120) * (large ? 1 : 1);
  const variant = hash(data.title) % 3;

  return (
    <div
      role="img"
      aria-label={alt}
      className={cx("relative overflow-hidden rounded-xs flex flex-col select-none", className)}
      style={{ width: w, height: h, background: bg, color: fg, padding: `${Math.round(w * 0.1)}px ${Math.round(w * 0.09)}px` }}
    >
      {/* feine Kante und Rückenfalz */}
      <span aria-hidden className="absolute inset-0 rounded-xs" style={{ boxShadow: `inset 0 0 0 1px ${fg}22` }} />
      <span aria-hidden className="absolute inset-y-0 left-[6%] w-px" style={{ background: `${fg}26` }} />
      {(variant === 0 || (variant === 1 && w < 80)) && <span aria-hidden className="block h-px w-8 mb-auto" style={{ background: fg, opacity: 0.7 }} />}
      {variant === 1 && w >= 80 && <span aria-hidden className="block text-[9px] tracking-[0.2em] uppercase mb-auto opacity-70" style={{ fontSize: Math.max(7, w * 0.055) }}>Leihregal</span>}
      <span
        className="font-serif leading-[1.04] break-words hyphens-auto"
        lang="de"
        style={{ fontSize: size * (scale > 1 ? 1 : 1), fontWeight: 480, letterSpacing: "-0.01em", marginTop: variant === 2 ? 0 : undefined }}
      >
        {data.title}
      </span>
      {variant === 2 && <span aria-hidden className="block h-px w-full my-2 mt-auto" style={{ background: fg, opacity: 0.5 }} />}
      {author && (
        <span className={cx("uppercase tracking-[0.12em] font-sans", variant === 2 ? "" : "mt-auto pt-2")} style={{ fontSize: Math.max(7.5, w * 0.06), opacity: 0.85 }}>
          {author}
        </span>
      )}
    </div>
  );
}
