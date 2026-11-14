/** Dominante Farbe eines Bildes: Hintergrund für Cover, bis das Bild geladen ist. */
import sharp from "sharp";

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/**
 * Dominante Farbe als «#rrggbb» (sharp: häufigster Farbton im 4096er-Histogramm).
 * Gerechnet wird auf einer kleinen Kopie; Transparenz gilt als Weiss. null, wenn sich das Bild nicht lesen lässt.
 */
export async function dominantColor(input: Buffer): Promise<string | null> {
  try {
    // stats() rechnet auf dem Eingabebild, darum zuerst verkleinern und als Puffer ausgeben
    const small = await sharp(input)
      .resize({ width: 64, height: 64, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .png()
      .toBuffer();
    const { dominant } = await sharp(small).stats();
    return `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`;
  } catch {
    return null;
  }
}
