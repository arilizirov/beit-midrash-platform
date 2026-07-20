// Flat ESLint config — TypeScript recommended rules over src/.
// YAGNI: eslint-config-next's framework rules can join once there is real UI
// surface to lint; today the codebase is one layout, one page, one kernel module.
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
);
