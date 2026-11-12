import type { ReactNode } from "react";
import type { TocItem } from "@/components/doc";

/** Inhalt der Hilfeseite in einer Sprache */
export type HelpContent = {
  title: string;
  description: string;
  eyebrow: string;
  heading: [string, string];
  lead: string;
  toc: TocItem[];
  quick: { eyebrow: string; title: string; note: string; steps: [n: string, title: string, text: string, href: string, more: string][] };
  body: ReactNode;
};
