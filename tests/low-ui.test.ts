/** Kleinere Punkte aus der Analyse: alte Systemtexte in Benachrichtigungen, Entfernungen pro Sprache */
import { describe, expect, it } from "vitest";
import { legacySystemText, systemText, renderSystemText } from "@/lib/notify/system-texts";
import { renderNotification } from "@/lib/notify";

describe("Alte Benachrichtigungen ohne Schlüssel", () => {
  it("übersetzt bekannte deutsche Systemtexte, lässt Freitext stehen", () => {
    expect(legacySystemText("Ein Exemplar ist ca. 700 m entfernt frei.", "fr")).toBe("Un exemplaire est libre à env. 700 m.");
    expect(legacySystemText("Ein Exemplar ist 1,4 km entfernt frei.", "it")).toBe("Un esemplare è libero a 1,4 km.");
    expect(legacySystemText("Direkt von Lea an Jonas weitergeben?", "fr")).toBe("Transmettre directement de Lea à Jonas ?");
    expect(legacySystemText("Ein Ersatz ist angeboten.", "it")).toBe("È stata offerta una sostituzione.");
    expect(legacySystemText("Hallo, passt dir Samstag?", "fr")).toBeUndefined();
    expect(legacySystemText("Ein Ersatz ist angeboten.", "de")).toBeUndefined();
  });

  it("renderNotification nutzt die Übersetzung für alte Einträge", () => {
    const r = renderNotification("title_alarm", { title: "Stiller", text: "Ein Exemplar ist ca. 700 m entfernt frei." }, "it");
    expect(r.body).toBe("Un esemplare è libero a circa 700 m.");
    const de = renderNotification("title_alarm", { title: "Stiller", text: "Ein Exemplar ist ca. 700 m entfernt frei." }, "de");
    expect(de.body).toBe("Ein Exemplar ist ca. 700 m entfernt frei.");
  });

  it("Entfernung im Italienischen einheitlich «circa»", () => {
    const t = systemText("title_alarm_free", { meters: 640 });
    expect(t.text).toBe("Ein Exemplar ist ca. 600 m entfernt frei.");
    expect(renderSystemText(t.textKey, t.textArgs, "it")).toBe("Un esemplare è libero a circa 600 m.");
    expect(renderSystemText(t.textKey, t.textArgs, "fr")).toBe("Un exemplaire est libre à env. 600 m.");
  });
});
