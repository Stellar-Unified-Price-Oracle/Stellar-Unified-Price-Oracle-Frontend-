import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Minimal BroadcastChannel stand-in. Channels with the same name receive
 * messages posted on any other channel, which matches the browser behaviour the
 * coordination relies on. A channel never receives its own message.
 */
class FakeBroadcastChannel {
  static channels: FakeBroadcastChannel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  closed = false

  constructor(public readonly name: string) {
    FakeBroadcastChannel.channels.push(this)
  }

  postMessage(data: unknown): void {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name && !channel.closed) {
        channel.onmessage?.({ data } as MessageEvent)
      }
    }
  }

  close(): void {
    this.closed = true
  }
}

/**
 * Loads a fresh copy of the module. Each copy has its own tab id and sender, so
 * two copies behave like two tabs sharing one origin.
 */
async function loadTab() {
  vi.resetModules()
  return import('./swUpdateChannel')
}

beforeEach(() => {
  FakeBroadcastChannel.channels = []
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('swUpdateChannel', () => {
  it('delivers an applying announcement from one tab to another', async () => {
    const tabA = await loadTab()
    const tabB = await loadTab()
    const listener = vi.fn()
    const unsubscribe = tabB.subscribeToSwUpdates(listener)

    tabA.broadcastSwUpdate({ type: 'applying' })

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'applying' }))
    unsubscribe()
  })

  it('delivers a dismissal with its snooze deadline', async () => {
    const tabA = await loadTab()
    const tabB = await loadTab()
    const listener = vi.fn()
    const unsubscribe = tabB.subscribeToSwUpdates(listener)

    tabA.broadcastSwUpdate({ type: 'dismissed', until: 1_234 })

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'dismissed', until: 1_234 }))
    unsubscribe()
  })

  it('does not deliver a tab its own broadcasts', async () => {
    const tab = await loadTab()
    const listener = vi.fn()
    const unsubscribe = tab.subscribeToSwUpdates(listener)

    tab.broadcastSwUpdate({ type: 'applying' })

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('drops malformed messages from other tabs', async () => {
    const tab = await loadTab()
    const listener = vi.fn()
    const unsubscribe = tab.subscribeToSwUpdates(listener)
    const other = new FakeBroadcastChannel('supo-sw-update')

    other.postMessage({ type: 'applying' })
    other.postMessage({ type: 'dismissed', until: Number.NaN, sender: 'x' })
    other.postMessage('not an object')

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('stops delivering once unsubscribed', async () => {
    const tabA = await loadTab()
    const tabB = await loadTab()
    const listener = vi.fn()
    tabB.subscribeToSwUpdates(listener)() // unsubscribe immediately

    tabA.broadcastSwUpdate({ type: 'applying' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('does nothing when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const tab = await loadTab()

    expect(() => tab.broadcastSwUpdate({ type: 'applying' })).not.toThrow()
    expect(tab.subscribeToSwUpdates(vi.fn())).toEqual(expect.any(Function))
  })
})
