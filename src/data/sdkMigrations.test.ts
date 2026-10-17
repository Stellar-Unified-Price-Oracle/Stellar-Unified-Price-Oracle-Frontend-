import { describe, expect, it } from 'vitest'
import { SDK_MIGRATIONS, SUPPORTED_SDK_MAJORS } from './sdkMigrations'

describe('SDK migration examples (#809)', () => {
  it('documents a migration for every supported SDK major', () => {
    for (const major of SUPPORTED_SDK_MAJORS) {
      expect(SDK_MIGRATIONS.some((migration) => migration.major === major)).toBe(true)
    }
  })

  it('lists each major at most once so the guide never shows duplicates', () => {
    const majors = SDK_MIGRATIONS.map((migration) => migration.major)
    expect(new Set(majors).size).toBe(majors.length)
  })

  it('pairs every example with a before snippet that avoids the SDK and an after snippet that uses it', () => {
    for (const migration of SDK_MIGRATIONS) {
      expect(migration.breakingChanges.length).toBeGreaterThan(0)
      expect(migration.examples.length).toBeGreaterThan(0)
      for (const example of migration.examples) {
        expect(example.before).not.toContain('OracleClient')
        expect(example.after).toContain('new OracleClient(')
        expect(example.after).toMatch(/await client\.\w+\(/)
      }
    }
  })
})
