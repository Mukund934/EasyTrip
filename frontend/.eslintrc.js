/**
 * Frontend lint configuration (IMP-097).
 *
 * This replaces an `eslint.config.mjs` that nothing could read. Flat config is an ESLint 9 format,
 * the installed ESLint is 8.x, and `next lint` on Next 13.4 looks for `.eslintrc*` — so `next lint`
 * found no config, dropped into its interactive first-run setup prompt, and exited without linting
 * anything. Lint had therefore never run on this codebase, which is the direct reason a third of
 * the tree could go unreachable and two components could sit imported-but-never-rendered with
 * nothing complaining.
 *
 * When the project moves to Next 15 / ESLint 9 (IMP-075), this becomes a flat config for real.
 */
module.exports = {
  root: true,
  extends: 'next/core-web-vitals',

  // Needed by `no-undef` below, and only by it: without an env the rule cannot tell `window` or
  // `localStorage` from a typo. `next/core-web-vitals` sets a parser but no globals, because it
  // never enables a rule that needs them.
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  rules: {
    // ON as of IMP-070 (Sprint 5.8), after a real defect got through: the browse page called
    // `setRecentSearches` — a setter that had been replaced by a hook two commits earlier and no
    // longer existed. `next build` compiled it, `next lint` passed it, and the SSR suite missed it
    // because the reference sits inside an onClick that only renders once the browser has search
    // history. It would have thrown on the first click.
    //
    // `next/core-web-vitals` does not extend `eslint:recommended`, so `no-undef` was simply off —
    // an asymmetry with the backend, which has had it since IMP-097. This is the cheapest gate
    // there is for a codebase being refactored: exactly one violation across all of `src/`, and
    // it was a bug.
    'no-undef': 'error',

    // The rule that would have caught the dead imports this sprint removed by hand.
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }
    ],

    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react-hooks/exhaustive-deps': 'warn',

    // Off until the remaining raw `<img>` tags are migrated (deferred from IMP-049). Leaving it on
    // would emit 19 warnings on every run for work that is already tracked, and a lint run that is
    // always noisy is a lint run nobody reads.
    '@next/next/no-img-element': 'off'
  },

  overrides: [
    {
      // The component and unit suite (IMP-093). `env: { jest: true }` declares
      // describe/test/expect/jest rather than switching `no-undef` off — the same choice the
      // backend made, and for the same reason: a typo'd identifier in a test should still fail,
      // and `no-undef` is exactly the rule that catches it.
      //
      // Note `next lint` only walks its default directories, so `tests/` was invisible to lint
      // until `--dir tests` was added to the script. A test file nothing lints is where a silent
      // typo lives longest.
      files: ['tests/**/*.{js,jsx}', 'jest.config.js', 'jest.setup.js', 'jest.env.js'],
      env: { jest: true, node: true }
    }
  ],

  ignorePatterns: ['node_modules/', '.next/', 'out/', 'build/']
};
