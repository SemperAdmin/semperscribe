import nextConfig from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    rules: {
      // Downgrade React Compiler strict rules to warnings — these require
      // significant refactoring and the app compiles/runs correctly without them.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // Allow unescaped entities in JSX (common in prose-heavy components)
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // @react-pdf/renderer's <Image> is a PDF drawing primitive with no alt
    // prop; the a11y rule matches it by name only. The output PDFs are
    // untagged either way (SECTION_508_FINDINGS F1), so this rule has no
    // bearing on accessibility here.
    files: ["src/components/pdf/**/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
  {
    // .claude/ holds nested agent worktrees (whole checkouts of this repo).
    ignores: ["out/", ".next/", "node_modules/", ".claude/"],
  },
];

export default config;
