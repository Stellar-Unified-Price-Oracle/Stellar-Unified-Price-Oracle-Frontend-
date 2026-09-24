# SDK quickstarts

These examples use the published `@stellar-unified-price-oracle/sdk` package (`1.0.0`).
The client talks to the same REST and WebSocket endpoints documented at `/api-docs`.

## React

```bash
npm install @stellar-unified-price-oracle/sdk@1.0.0
```

```tsx
import { usePrice, usePriceSubscription } from '@stellar-unified-price-oracle/sdk/react'

export function PriceCard() {
  const { price, loading, error } = usePrice('XLM-USD')
  usePriceSubscription(['XLM-USD'])

  if (loading) return <span>Loading…</span>
  if (error) return <span role="alert">{error.message}</span>
  return <strong>{price ? `${price.price} ${price.assetPair}` : 'No price'}</strong>
}
```

## Vanilla browser

```html
<output id="price">Connecting…</output>
<script type="module">
  import { OracleClient } from '@stellar-unified-price-oracle/sdk'
  const client = new OracleClient({ baseUrl: 'https://api.example.com' })
  const output = document.querySelector('#price')
  const render = (price) => { output.textContent = `${price.assetPair}: ${price.price}` }
  render(await client.getPrice('XLM-USD'))
  const stop = client.subscribe(['XLM-USD'], render)
  window.addEventListener('pagehide', stop, { once: true })
</script>
```

## Node service

```bash
npm install @stellar-unified-price-oracle/sdk@1.0.0
```

```ts
import { OracleClient } from '@stellar-unified-price-oracle/sdk'

const client = new OracleClient({ baseUrl: process.env.ORACLE_API_URL })
const price = await client.getPrice('XLM-USD')
console.log(`${price.assetPair} = ${price.price}`)
```

## Subscribe to live prices

The subscription callback runs for every update, so a live counter is just ordinary UI state:

```ts
const updates = document.querySelector('#updates')
let count = 0
const stop = client.subscribe(['XLM-USD', 'BTC-USD'], (price) => {
  count += 1
  updates.textContent = `${count} updates — ${price.assetPair}: ${price.price}`
})
```

Call `stop()` when the view or process no longer needs updates.

## Alert conditions

Alerts can combine an absolute threshold with a percentage move. The SDK sends the same shape used by the dashboard:

```ts
await client.createAlert({
  assetPair: 'XLM-USD',
  upperThreshold: 1.25,
  percentageThreshold: 5,
  percentageDirection: 'up',
  percentageWindow: '15min',
})
```

Use `percentageDirection: 'down'` for a fall, or `'either'` to alert in both directions. Keep the package version in this guide aligned with the published SDK release before publishing a new release.
