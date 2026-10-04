// ESLint flat config. Next.js 16 removed `next lint`; run `npm run lint` (eslint .).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Several client components read localStorage/sessionStorage inside a
      // mount effect and then setState, on purpose, so the server render and
      // the first client render match. Keep the rule visible but non-blocking.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "uploads/**",
    "design/**",
  ]),
]);
