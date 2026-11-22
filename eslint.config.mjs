import coreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * ESLint (flat config) — Next.js core-web-vitals rules.
 *
 * `next lint` was removed in Next 16, so the project lints with `eslint`
 * directly (`npm run lint`). Generated folders, the archived corporate export
 * and uploaded media are excluded; everything in `src` is linted.
 */
export default [
  {
    ignores: [".next/**", "node_modules/**", "archive/**", "public/uploads/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Hydration reads: the cart, wishlist and filters are restored from
      // localStorage/sessionStorage after mount because the server render has no
      // storage. That is a one-shot "external system → state" sync, which this
      // rule flags by design. Kept as a warning so a genuinely cascading effect
      // still shows up in review without failing the gate.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
