import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['dashboard', 'api', 'chart', 'hooks', 'components', 'ci', 'deps', 'config'],
    ],
    'scope-case': [2, 'always', 'lower-case'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'style', 'perf', 'ci', 'revert'],
    ],
  },
}

export default config
