export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'style', 'ci', 'perf', 'revert'],
    ],
    'scope-enum': [1, 'always', ['dashboard', 'api', 'chart', 'hooks', 'components', 'config', 'deps', 'ci']],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
  },
}
