import type { ReactNode } from "react";
import type { TocItem } from "@/components/doc";

/** Inhalt der Regeln in einer Sprache */
export type RulesContent = {
  title: string;
  description: string;
  eyebrow: string;
  heading: [string, string];
  lead: string;
  toc: TocItem[];
  summary: { eyebrow: string; title: string; items: [title: string, text: string, href: string][] };
  body: ReactNode;
};
