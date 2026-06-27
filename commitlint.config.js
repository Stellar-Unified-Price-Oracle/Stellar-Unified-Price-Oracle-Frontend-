export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['dashboard', 'api', 'chart', 'deps', 'ci', 'config']],
    'scope-case': [0],
  },
}
