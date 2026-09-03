import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { presetStorage, type CustomAlertPresetInput } from './presetStorage'
import type { ConditionGroup } from '../types'

const sampleGroup: ConditionGroup = {
  id: 'g1',
  logic: 'AND',
  conditions: [{ id: 'c1', field: 'price', operator: 'gt', value: 100 }],
}

function sampleInput(overrides: Partial<CustomAlertPresetInput> = {}): CustomAlertPresetInput {
  return {
    name: 'My Custom Preset',
    description: 'Fires above 100',
    suggestedAssetPair: 'BTC/USD',
    percentageMode: false,
    conditionGroup: sampleGroup,
    triggerOnce: false,
    cooldownMinutes: 5,
    escalationPolicy: null,
    ...overrides,
  }
}

beforeEach(async () => {
  presetStorage._reset()
  // fake-indexeddb persists between tests within the same run unless the DB is
  // deleted, so clear out any records the previous test left behind.
  const existing = await presetStorage.list()
  await Promise.all(existing.map((p) => presetStorage.remove(p.id)))
})

describe('presetStorage', () => {
  it('starts empty', async () => {
    expect(await presetStorage.list()).toEqual([])
  })

  it('creates a preset and assigns id + timestamps', async () => {
    const created = await presetStorage.create(sampleInput())
    expect(created.id).toBeTruthy()
    expect(created.createdAt).toBeGreaterThan(0)
    expect(created.updatedAt).toBe(created.createdAt)
    expect(created.name).toBe('My Custom Preset')
  })

  it('lists created presets, newest first', async () => {
    const first = await presetStorage.create(sampleInput({ name: 'First' }))
    await new Promise((r) => setTimeout(r, 2))
    const second = await presetStorage.create(sampleInput({ name: 'Second' }))
    const all = await presetStorage.list()
    expect(all.map((p) => p.id)).toEqual([second.id, first.id])
  })

  it('gets a preset by id, and returns null for an unknown id', async () => {
    const created = await presetStorage.create(sampleInput())
    expect((await presetStorage.get(created.id))?.name).toBe('My Custom Preset')
    expect(await presetStorage.get('nonexistent')).toBeNull()
  })

  it('updates a preset in place, bumping updatedAt', async () => {
    const created = await presetStorage.create(sampleInput())
    await new Promise((r) => setTimeout(r, 2))
    const updated = await presetStorage.update(created.id, { name: 'Renamed' })
    expect(updated?.name).toBe('Renamed')
    expect(updated?.id).toBe(created.id)
    expect(updated!.updatedAt).toBeGreaterThan(created.updatedAt)
  })

  it('update returns null for an unknown id', async () => {
    expect(await presetStorage.update('nonexistent', { name: 'x' })).toBeNull()
  })

  it('deletes a preset', async () => {
    const created = await presetStorage.create(sampleInput())
    await presetStorage.remove(created.id)
    expect(await presetStorage.get(created.id)).toBeNull()
  })

  it('deleting a nonexistent preset does not throw', async () => {
    await expect(presetStorage.remove('nonexistent')).resolves.toBeUndefined()
  })
})
