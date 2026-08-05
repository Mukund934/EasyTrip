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
  rules: {
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
  ignorePatterns: ['node_modules/', '.next/', 'out/', 'build/']
};
