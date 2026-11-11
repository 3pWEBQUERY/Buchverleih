import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { Spine } from "@/components/spine";

/**
 * Schlichte Hülle ohne App-Navigation (Offline, Konto gesperrt).
 * Ohne Datenbank, damit die Offline-Seite statisch bleibt.
 */
const SHELF: [string, string][] = [
  ["Homo faber", "Max Frisch"], ["Momo", "Michael Ende"], ["Die Physiker", "Friedrich Dürrenmatt"], ["Effi Briest", "Theodor Fontane"],
  ["Siddhartha", "Hermann Hesse"], ["Heidi", "Johanna Spyri"], ["Die Wand", "Marlen Haushofer"], ["Stiller", "Max Frisch"],
  ["Schachnovelle", "Stefan Zweig"], ["Der Process", "Franz Kafka"], ["Middlemarch", "George Eliot"], ["Woyzeck", "Georg Büchner"],
  ["Buddenbrooks", "Thomas Mann"], ["Der grüne Heinrich", "Gottfried Keller"],
];

export function StandaloneShell({ children, motif }: { children: ReactNode; motif: { label: string; gap?: number } }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-16 flex items-center border-b border-line">
        <div className="w-full max-w-[1320px] mx-auto px-4 md:px-10"><Wordmark /></div>
      </header>
      <main id="inhalt" className="flex-1 w-full max-w-[1320px] mx-auto px-4 md:px-10 py-8 md:py-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 content-start lg:content-center lg:items-center">
        <div className="order-2 lg:order-1 max-w-xl">{children}</div>
        <Motif label={motif.label} gap={motif.gap} />
      </main>
    </div>
  );
}

/** Dunkle Bühne mit einem Regal aus Buchrücken; optional mit einer Lücke im Regal */
function Motif({ label, gap }: { label: string; gap?: number }) {
  return (
    <div className="order-1 lg:order-2 surface-night rounded-[22px] overflow-hidden flex flex-col h-[148px] lg:h-[460px] anim-rise" aria-hidden>
      <p className="eyebrow !text-night-muted px-5 pt-4 lg:px-9 lg:pt-8">{label}</p>
      {/* Mobil verkleinert gesetzt, damit die Proportionen gleich bleiben */}
      <div className="mt-auto overflow-hidden lg:hidden" style={{ height: 105 }}>
        <div style={{ transform: "scale(0.42)", transformOrigin: "top left", width: "238%" }}><Row gap={gap} /></div>
      </div>
      <div className="mt-auto hidden lg:block overflow-hidden"><Row gap={gap} /></div>
      <div className="h-[6px] bg-night-ink/90 flex-none" />
    </div>
  );
}

function Row({ gap }: { gap?: number }) {
  return (
    <div className="flex items-end gap-[6px] px-6 lg:px-9" style={{ height: 250 }}>
      {SHELF.map(([t, a], i) => (
        <div key={t} className="anim-cover" style={{ animationDelay: `${120 + i * 30}ms` }}>
          {i === gap
            ? <div style={{ width: 46, height: 206 }} className="rounded-[3px] border-[1.5px] border-dashed border-night-muted/60" />
            : <Spine title={t} author={a} height={240} />}
        </div>
      ))}
    </div>
  );
}
