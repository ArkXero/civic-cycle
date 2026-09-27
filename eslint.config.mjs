import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated reports and local Ariadne fixtures are gitignored artifacts.
    "coverage/**",
    ".ariadne/**",
    // shadcn generated components — never edited manually
    "components/ui/**",
  ]),
  // eslint-plugin-react bundled in eslint-config-next uses context.getFilename()
  // which was removed in ESLint v10. Disable all react/* rules to prevent crash.
  // TypeScript + react-hooks + @next/next cover the same concerns without the breakage.
  // set-state-in-effect fires on valid async-fetch-then-setState patterns.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react/display-name": "off",
      "react/jsx-key": "off",
      "react/jsx-no-comment-textnodes": "off",
      "react/jsx-no-duplicate-props": "off",
      "react/jsx-no-target-blank": "off",
      "react/jsx-no-undef": "off",
      "react/jsx-uses-react": "off",
      "react/jsx-uses-vars": "off",
      "react/no-children-prop": "off",
      "react/no-danger-with-children": "off",
      "react/no-deprecated": "off",
      "react/no-direct-mutation-state": "off",
      "react/no-find-dom-node": "off",
      "react/no-is-mounted": "off",
      "react/no-render-return-value": "off",
      "react/no-string-refs": "off",
      "react/no-unescaped-entities": "off",
      "react/no-unknown-property": "off",
      "react/no-unsafe": "off",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/require-render-return": "off",
    },
  },
]);

export default eslintConfig;
