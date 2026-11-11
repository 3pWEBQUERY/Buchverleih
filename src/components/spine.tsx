/**
 * Buchrücken: das Signatur-Element. Ein Regal von der Seite gesehen –
 * Farbe, Höhe und Breite ergeben sich deterministisch aus dem Titel.
 */
const CLOTH: [string, string][] = [
  ["#6d2b2a", "#f3e7d3"], ["#2e4a3b", "#eee4cc"], ["#22324a", "#efe6d2"], ["#b8902f", "#1f1b12"],
  ["#a34a29", "#f6ead8"], ["#55624a", "#f0e9d6"], ["#4b2e44", "#f1e4d8"], ["#2b5a5b", "#eef0e4"],
  ["#2f2d29", "#e9dfc9"], ["#d4a64a", "#1d1a12"], ["#7a3b2e", "#f4e8d6"], ["#384a6b", "#eee6d6"],
  ["#e6dcc4", "#2a241b"], ["#cdb98f", "#2a241b"], ["#1f2a26", "#d9c98f"], ["#8c2f39", "#f3e3cf"],
  ["#d23c1a", "#fff4ec"],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function spineStyle(title: string, author = "") {
  const h = hash(title + author);
  const [bg, fg] = CLOTH[h % CLOTH.length];
  return {
    bg,
    fg,
    height: 0.78 + ((h >> 5) % 23) / 100, // 78–100 %
    width: 34 + ((h >> 9) % 5) * 6, // 34–58 px
    band: (h >> 13) % 3, // Zierband oben, unten oder keins
  };
}

export function Spine({ title, author, height = 220, className = "" }: { title: string; author?: string; height?: number; className?: string }) {
  const s = spineStyle(title, author);
  const h = Math.round(height * s.height);
  return (
    <div className={`spine relative flex-none rounded-[3px] overflow-hidden ${className}`} style={{ width: s.width, height: h, background: s.bg, color: s.fg }}>
      {s.band !== 2 && (
        <span aria-hidden className="absolute inset-x-0 h-[3px]" style={{ background: s.fg, opacity: 0.55, [s.band === 0 ? "top" : "bottom"]: 14 }} />
      )}
      <span
        className="absolute inset-0 flex items-center justify-start px-3 font-serif whitespace-nowrap overflow-hidden"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: Math.min(17, s.width * 0.42), letterSpacing: "-0.01em" }}
      >
        {title}
      </span>
    </div>
  );
}
