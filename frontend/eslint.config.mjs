import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';

/**
 * Frontend lint configuration, flat format (`IMP-097`, migrated for Next 16 / ESLint 9).
 *
 * The `.eslintrc.js` this replaces ended with a promise: *"When the project moves to Next 15 /
 * ESLint 9 (`IMP-075`), this becomes a flat config for real."* This is that. It is also **forced**
 * rather than chosen — `next lint` was deprecated in Next 15 and **removed in 16**, taking the
 * `--dir` flag the lint script depended on with it, so `package.json` now calls `eslint` directly.
 *
 * **Root and backend deliberately stay on `.eslintrc.js`.** Both are still on ESLint 8, which does
 * not require flat config, and converting them would mean re-verifying lint across a tier this
 * change does not otherwise touch. Two config formats in one repository is a smell worth naming,
 * and it is the smaller cost — the alternative is folding an unrelated tier into a Next upgrade
 * that `FRAMEWORK_UPGRADE_PLAN` §5 says to do alone.
 *
 * `eslint-config-next@16` **ships flat config natively**, so it is imported directly rather than
 * wrapped in `FlatCompat` — the compat shim fails on it with a circular-structure error, because it
 * is trying to normalise something that is already in the target format. Every rule below is the one
 * it replaced, with its reasoning intact: a lint config that loses its comments in a format
 * migration is one nobody can argue with afterwards.
 */

export default [
  {
    // Flat config replaces `ignorePatterns`, and unlike it, `ignores` in a config object with no
    // other keys applies globally.
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts']
  },

  ...nextCoreWebVitals,

  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      // Needed by `no-undef` below, and only by it: without globals the rule cannot tell `window`
      // or `localStorage` from a typo. `next/core-web-vitals` sets a parser but no globals, because
      // it never enables a rule that needs them.
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      // ON as of IMP-070 (Sprint 5.8), after a real defect got through: the browse page called
      // `setRecentSearches` — a setter that had been replaced by a hook two commits earlier and no
      // longer existed. `next build` compiled it, `next lint` passed it, and the SSR suite missed it
      // because the reference sits inside an onClick that only renders once the browser has search
      // history. It would have thrown on the first click.
      'no-undef': 'error',

      // The rule that would have caught the dead imports Sprint 5.8 removed by hand.
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
      '@next/next/no-img-element': 'off',

      /**
       * The React Compiler rules, off — **tracked, not dismissed** (`BL-146`).
       *
       * `eslint-plugin-react-hooks` v6 ships with Next 16 and turns on a family of rules that check
       * a codebase for *React Compiler* readiness. This project does not use the compiler. They are
       * not upgrade breakage either: every one of the 37 findings is pre-existing, in code that
       * passes 699 component assertions and 141 browser journeys.
       *
       * They are recorded here rather than lost, because four of them are worth a look on their own
       * merits and one is arguably a live bug:
       *
       *   - **29 × `set-state-in-effect`** — `setState` called synchronously inside an effect. The
       *     common React idiom, and the bulk of the count.
       *   - **`purity` — `PlaceCard.jsx:76` calls `Date.now()` during render.** Genuinely
       *     non-deterministic: the server and the browser can compute a different "days ago" across
       *     a midnight boundary, which is the `BUG-044` hydration-mismatch family this repository
       *     has already been bitten by twice.
       *   - **`static-components` — `PlaceWeather.jsx:114` defines a component during render**,
       *     which remounts its subtree on every parent render.
       *   - **`refs` — `useDismissable.js:23` writes a ref during render.** The standard latest-ref
       *     pattern; correct today, and the thing the compiler cannot prove.
       *   - **`immutability` ×2 in `ExploreMap.jsx`**, `preserve-manual-memoization` ×2 in
       *     `useSharePlace.jsx`, `globals` ×1 in a test probe.
       *
       * Fixing them is a refactor of working, tested code and does not belong inside a dependency
       * upgrade — `FRAMEWORK_UPGRADE_PLAN` §5 rule 1 is one step per commit. `BL-146` carries the
       * list; turning this block back on is how that work gets verified.
       */
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/globals': 'off',

      /**
       * One date policy, enforced rather than agreed (`IMP-122`).
       *
       * `toLocaleDateString` and friends silently inherit **two** things from the runtime — the
       * locale and the time zone — and this project has shipped a bug from each. `BUG-044` was Node
       * rendering "1 Jan 2026" while the browser rendered "Jan 1, 2026", failing hydration on every
       * card. `BUG-046` was a UTC-midnight value showing the previous day to everyone behind UTC.
       * `BUG-058` was a third, in the same family.
       *
       * So the rule, not the intention. `utils/dateFormat.js` is the only module allowed to call
       * these, and it names both the locale and the zone every time.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/]',
          message:
            'Use the helpers in utils/dateFormat.js — they pin the locale AND the time zone. ' +
            'Calling toLocale*String directly inherits both from the runtime, which is BUG-044 ' +
            '(hydration mismatch) and BUG-046 (date off by one) waiting to happen.'
        }
      ]
    }
  },

  {
    // The one module allowed to format a date, and the reason the rule above can be an error
    // everywhere else.
    //
    // `dateFormat.test.js` is listed for the opposite reason: it must call the **unpinned**
    // formatter to prove the pinned one gives a different answer. That assertion — "the local clock
    // says otherwise, which is the whole point" — is what stops the timezone tests from passing
    // against a fixture that was never a boundary case. Banning the raw call there would delete the
    // guard on the guard.
    files: ['src/utils/dateFormat.js', 'tests/dateFormat.test.js'],
    rules: { 'no-restricted-syntax': 'off' }
  },

  {
    // The component and unit suite (IMP-093). Declaring the jest globals rather than switching
    // `no-undef` off — the same choice the backend made, and for the same reason: a typo'd
    // identifier in a test should still fail, and `no-undef` is exactly the rule that catches it.
    //
    // Under `next lint` this directory was invisible until `--dir tests` was added to the script.
    // Flat config has no such default, and `package.json` now names both directories explicitly.
    files: ['tests/**/*.{js,jsx}', 'jest.config.js', 'jest.setup.js', 'jest.env.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    }
  }
];
