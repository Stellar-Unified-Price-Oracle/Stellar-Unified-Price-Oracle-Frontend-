import { describe, expect, it } from 'vitest'
import { getMissingRequiredEnvVars } from './validateEnv'

describe('getMissingRequiredEnvVars', () => {
  it('returns no missing variables when all required values are set', () => {
    expect(
      getMissingRequiredEnvVars({
        VITE_API_URL: 'https://api.example.com',
        VITE_WS_URL: 'wss://api.example.com',
      }),
    ).toEqual([])
  })

  it('reports missing and blank required variables', () => {
    expect(
      getMissingRequiredEnvVars({
        VITE_API_URL: '',
        VITE_WS_URL: '   ',
      }),
    ).toEqual(['VITE_API_URL', 'VITE_WS_URL'])
  })

  it('ignores optional variables', () => {
    expect(
      getMissingRequiredEnvVars({
        VITE_API_URL: 'https://api.example.com',
        VITE_WS_URL: 'wss://api.example.com',
        VITE_ANALYTICS_URL: '',
      }),
    ).toEqual([])
  })
})
