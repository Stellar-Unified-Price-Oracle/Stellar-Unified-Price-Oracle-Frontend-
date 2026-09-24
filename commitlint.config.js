/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // ── Types ───────────────────────────────────────────────────────────────
    // Only the types listed in the project's commit convention are allowed.
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'perf', 'ci'],
    ],

    // ── Scopes ──────────────────────────────────────────────────────────────
    // Scope is optional but when provided must be one of the registered values.
    'scope-enum': [
      1, // warn — scopes are advisory, not hard-blocked
      'always',
      [
        'components',
        'api',
        'hooks',
        'tests',
        'build',
        'deps',
        'docs',
        'workers',
        'config',
        'context',
        'utils',
        'types',
        'pages',
        'i18n',
      ],
    ],

    // ── Subject ─────────────────────────────────────────────────────────────
    // Keep the subject line concise and in lower-case imperative mood.
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],

    // ── Header length ───────────────────────────────────────────────────────
    'header-max-length': [2, 'always', 100],

    // ── Body ────────────────────────────────────────────────────────────────
    // Body is optional. When present, separate it from the subject with a blank
    // line and use it to explain *what* changed and *why* (not how).
    'body-leading-blank': [2, 'always'],

    // ── Footer ──────────────────────────────────────────────────────────────
    // Footer is optional. Use it for breaking-change notices and issue refs:
    //   BREAKING CHANGE: description
    //   Closes #42
    'footer-leading-blank': [2, 'always'],
  },

  // Prompt helpers (used by `git cz` / Commitizen if installed)
  prompt: {
    questions: {
      type: {
        description: 'Select the type of change you are committing',
        enum: {
          feat:     { description: 'A new feature',                   title: 'Features',         emoji: '✨' },
          fix:      { description: 'A bug fix',                       title: 'Bug Fixes',        emoji: '🐛' },
          docs:     { description: 'Documentation only changes',      title: 'Documentation',    emoji: '📚' },
          refactor: { description: 'A code change that neither fixes a bug nor adds a feature', title: 'Refactoring', emoji: '♻️' },
          perf:     { description: 'A code change that improves performance', title: 'Performance Improvements', emoji: '⚡' },
          test:     { description: 'Adding missing tests or correcting existing tests', title: 'Tests', emoji: '🧪' },
          build:    { description: 'Changes that affect the build system or external dependencies', title: 'Builds', emoji: '🏗️' },
          ci:       { description: 'Changes to CI configuration files and scripts', title: 'Continuous Integration', emoji: '⚙️' },
          chore:    { description: "Other changes that don't modify src or test files", title: 'Chores', emoji: '🔧' },
        },
      },
    },
  },
}
