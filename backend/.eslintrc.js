/**
 * Backend lint configuration (IMP-097).
 *
 * The backend had none at all. `.eslintrc.js` rather than `.eslintrc.json` because the rationale
 * below is worth keeping next to the rules, and ESLint 8 rejects unknown top-level keys — a `"//"`
 * comment property is a config error, not a comment.
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
    // Express error middleware must declare four parameters to be recognised as error middleware,
    // and route handlers routinely ignore `next` — flagging those would train people to ignore
    // this rule rather than fix anything.
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^(_|next$)',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }
    ],

    // Deliberately off for now. The server logs ~340 times through `console.*`; turning this on
    // before IMP-071 replaces them with a real logger would produce a wall of warnings nobody
    // reads, which is how a lint config gets ignored. IMP-071 flips it on.
    'no-console': 'off',

    'no-empty': ['error', { allowEmptyCatch: true }]
  },
  ignorePatterns: ['node_modules/', 'tmp/']
};
