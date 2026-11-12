// ESLint (Flat Config). `next lint` gibt es seit Next 16 nicht mehr.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Bilder kommen signiert aus dem Bucket bzw. als Covers; next/image bringt hier nichts
      "@next/next/no-img-element": "off",
      // Regeln für den React Compiler (noch nicht aktiv): bestehende, funktionierende Muster
      // (setState im Effekt beim Zurücksetzen, Date.now() im Render, Refs im Scanner) als Warnung führen
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default config;
