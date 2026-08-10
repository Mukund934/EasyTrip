/**
 * Root lint configuration — the workspace files the tiers do not own (`TD-021`).
 *
 * `backend/` and `frontend/` each carry their own `.eslintrc.js` and are linted by their own
 * scripts. What nothing covered until now was everything *between* them: `e2e/`, `scripts/` and
 * `playwright.config.js`. That is roughly 600 lines of JavaScript — including the code that
 * provisions a database and starts a server — with no static checking at all.
 *
 * This is the same gap `TD-007` described (a lint config nothing loaded) and the same one Sprint
 * 6.2 closed for `frontend/tests`, where `next lint` turned out to walk only its default
 * directories. A directory nothing checks is where a mistake lives longest, and this repo has
 * already paid for that twice.
 *
 * **`root: true` and the ignore list matter.** Without them ESLint would walk up into the tier
 * configs, or this config would apply to files that already have one — two configs disagreeing
 * about the same file is worse than one config missing it.
 */
module.exports = {
  root: true,

  env: {
    node: true,
    es2022: true
  },

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script'
  },

  extends: 'eslint:recommended',

  rules: {
    // The rule this config mainly exists for. These files run a database, spawn a server and tear
    // both down — a typo'd identifier in an error path would surface as a mysterious hang in CI
    // rather than as an error.
    'no-undef': 'error',

    'no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
    ],

    // Deliberately allowed here, unlike the backend: `global-setup.js` and
    // `check-module-size.mjs` report progress and failures to a terminal. That IS their output.
    'no-console': 'off',

    // An empty catch is how "not on PATH, fall through" and "already stopped" are expressed in the
    // teardown. Each one carries a comment saying so, which `allowEmptyCatch` permits.
    'no-empty': ['error', { allowEmptyCatch: true }]
  },

  overrides: [
    {
      // `scripts/` is ESM (`.mjs`), the rest of the workspace is CommonJS.
      files: ['scripts/**/*.mjs'],
      parserOptions: { sourceType: 'module' }
    },
    {
      // Playwright's `test`/`expect` are imported rather than global, so no extra env is needed —
      // but the specs do use `Buffer` and the Node globals, which `env.node` already supplies.
      files: ['e2e/**/*.spec.js'],
      rules: {
        // A spec that builds a locator and never asserts on it is a real mistake, but the pattern
        // `const x = page.locator(...)` used only inside `expect(x)` reads as unused to ESLint in
        // some shapes. Kept as an error anyway — there are no such cases today, and a warning
        // nobody reads is the thing this file exists to prevent.
        'no-unused-vars': 'error'
      }
    }
  ],

  // Everything with its own config, plus build output and dependencies. This file must not reach
  // into a tier that already declares its own rules.
  ignorePatterns: [
    'node_modules/',
    'backend/',
    'frontend/',
    'test-results/',
    'playwright-report/',
    'docs/',
    '*.md'
  ]
};
