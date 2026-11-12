"use client";
import { useToast } from "@/components/toast";
import { cx } from "@/components/ui";

/** Teilen: auf dem Handy das System-Menü, sonst Link in die Zwischenablage */
export function ShareButton({ title, text, path, className }: { title: string; text?: string; path: string; className?: string }) {
  const toast = useToast();
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ text: "Link kopiert." }, 2500);
    } catch {
      toast.error("Kopieren ging nicht. Kopiere den Link aus der Adresszeile.");
    }
  }
  return (
    <button type="button" onClick={share}
      className={cx("h-11 rounded-[6px] border border-line-strong font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:border-accent hover:text-accent-hover transition-colors", className)}>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
      Teilen
    </button>
  );
}
