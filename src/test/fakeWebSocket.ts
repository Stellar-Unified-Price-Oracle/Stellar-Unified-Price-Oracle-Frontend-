export interface FakeWebSocketOptions {
  openDelay?: number
  messageLatency?: number
  closeDelay?: number
}

export class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  url: string
  readyState: number = FakeWebSocket.CONNECTING
  bufferedAmount = 0
  extensions = ''
  protocol = ''
  binaryType: BinaryType = 'blob'

  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  sent: string[] = []
  closed = false
  closeCode: number | undefined
  closeReason: string | undefined

  private options: FakeWebSocketOptions
  private autoOpenTimer: ReturnType<typeof setTimeout> | null = null

  constructor(url: string, options: FakeWebSocketOptions = {}) {
    this.url = url
    this.options = options

    if (options.openDelay != null) {
      this.autoOpenTimer = setTimeout(() => this.simulateOpen(), options.openDelay)
    }
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closed = true
    this.closeCode = code
    this.closeReason = reason
    this.readyState = FakeWebSocket.CLOSING

    const delay = this.options.closeDelay ?? 0
    if (delay > 0) {
      setTimeout(() => {
        this.readyState = FakeWebSocket.CLOSED
        this.onclose?.(new CloseEvent('close', { code, reason }))
      }, delay)
    } else {
      this.readyState = FakeWebSocket.CLOSED
      this.onclose?.(new CloseEvent('close', { code, reason }))
    }
  }

  addEventListener(): void {
    // stub - not used by current codebase
  }

  removeEventListener(): void {
    // stub - not used by current codebase
  }

  dispatchEvent(): boolean {
    return true
  }

  simulateOpen(): void {
    if (this.autoOpenTimer) {
      clearTimeout(this.autoOpenTimer)
      this.autoOpenTimer = null
    }
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: unknown): void {
    this.dispatchMessageEvent(JSON.stringify(data))
  }

  /**
   * Sends a raw string as the message event's `data`, bypassing
   * `JSON.stringify` (#474). Use this to simulate a partial/truncated frame
   * or non-JSON garbage that a real flaky connection might deliver —
   * `simulateMessage` can only ever produce well-formed JSON, so
   * malformed-payload tests need this instead.
   */
  simulateRawMessage(raw: string): void {
    this.dispatchMessageEvent(raw)
  }

  /**
   * Dispatches each message in `messages`, in the exact array order given —
   * pair with out-of-sequence `seq` values to simulate a real unstable
   * connection re-ordering or re-delivering frames (#474).
   */
  simulateOutOfOrder(messages: unknown[]): void {
    messages.forEach((m) => this.simulateMessage(m))
  }

  /**
   * Dispatches `messages` in order, silently skipping the ones at
   * `dropIndices` — as if a lossy connection had simply never delivered
   * them (#474). Silent drops are the default/expected shape of packet loss:
   * nothing arrives, nothing errors.
   */
  simulateWithDrops(messages: unknown[], dropIndices: number[]): void {
    const drops = new Set(dropIndices)
    messages.forEach((m, i) => {
      if (!drops.has(i)) this.simulateMessage(m)
    })
  }

  private dispatchMessageEvent(data: string): void {
    const event = new MessageEvent('message', { data })

    if (this.options.messageLatency != null && this.options.messageLatency > 0) {
      setTimeout(() => this.onmessage?.(event), this.options.messageLatency)
    } else {
      this.onmessage?.(event)
    }
  }

  simulateClose(code?: number, reason?: string): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code, reason }))
  }

  simulateError(): void {
    this.onerror?.(new Event('error'))
  }

  reset(): void {
    if (this.autoOpenTimer) {
      clearTimeout(this.autoOpenTimer)
      this.autoOpenTimer = null
    }
    this.readyState = FakeWebSocket.CONNECTING
    this.sent = []
    this.closed = false
    this.closeCode = undefined
    this.closeReason = undefined
    this.onopen = null
    this.onclose = null
    this.onmessage = null
    this.onerror = null
  }
}
