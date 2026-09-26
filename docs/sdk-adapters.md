# SDK framework adapters

## Vanilla observer

```ts
import { PriceHub } from '@stellar-unified-price-oracle/sdk'

const hub = new PriceHub({ url: 'wss://oracle.example/ws' })
const off = hub.subscribe('XLM/USD', (p) => console.log(p.price))
hub.onStatus((s) => console.log(s))
off() // last unsubscribe closes the socket
```

Observers of the same pair share one upstream subscription (ref-counted).

## React

```tsx
import { OracleProvider, usePrice, usePrices, useConnectionStatus } from '@stellar-unified-price-oracle/sdk/react'

function Price() {
  const p = usePrice('XLM/USD')
  const status = useConnectionStatus()
  return <span>{p?.price ?? '...'} ({status})</span>
}
export const App = () => <OracleProvider options={{ url: 'wss://oracle.example/ws' }}><Price /></OracleProvider>
```

Hooks are SSR-safe: server render returns empty snapshots and never touches `WebSocket`. `react` is a peer dependency of the `/react` entry point.
