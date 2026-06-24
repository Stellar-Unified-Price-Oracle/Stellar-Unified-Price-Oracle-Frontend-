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
    const event = new MessageEvent('message', { data: JSON.stringify(data) })

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
