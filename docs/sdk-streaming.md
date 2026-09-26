# SDK streaming client

```ts
import { StreamClient } from '@stellar-unified-price-oracle/sdk'

const stream = new StreamClient({ url: 'wss://oracle.example/ws', pairs: ['XLM/USD'] })
stream.on('price', (p) => console.log(p.assetPair, p.price))
stream.on('status', (s) => console.log('state', s))
stream.connect()
// later
stream.close()
```

## Events

- `price`: validated `PriceData`.
- `heartbeat`: `{ timestamp }`.
- `status`: `idle | connecting | connected | reconnecting | closed`.
- `error`: transport errors (reconnect proceeds automatically).

## Lifecycle

`connect()` opens the socket and subscribes to all pairs. On close the client reconnects with jittered exponential backoff (`retry` option, same algorithm as the REST retry policy) and resubscribes. `close()` stops reconnection permanently. Malformed frames are dropped silently.

Pass a custom `transport` factory to swap WebSocket for another transport (e.g. an SSE fallback).
