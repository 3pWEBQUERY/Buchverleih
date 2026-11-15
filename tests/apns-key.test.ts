import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { apnsKey } from "@/lib/apns";
describe("apnsKey", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const body = pem.split("\n").filter((l) => l && !l.startsWith("-----")).join("");
  for (const [name, v] of Object.entries({
    pem, escaped: pem.replace(/\n/g, "\\n"), spaces: pem.replace(/\n/g, " "), bodyOnly: body, b64file: Buffer.from(pem).toString("base64"), quoted: `"${pem}"`,
  })) it(name, () => expect(apnsKey(v).asymmetricKeyType).toBe("ec"));
});
