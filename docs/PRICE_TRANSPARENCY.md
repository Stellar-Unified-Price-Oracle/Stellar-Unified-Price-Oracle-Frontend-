# Price transparency features and API dependencies

This frontend reuses the API's aggregate confidence, price history, contributor
list, and optional WebSocket `sourcePrices`. It does not invent accuracy labels,
confidence factors, source prices, or source-tick identifiers.

## Confidence by asset and volatility regime

The dashboard groups the latest in-memory WebSocket ticks for each asset into
relative low, moderate, and high realized-volatility tertiles. Volatility is
computed from rolling standard deviation of recent aggregate percentage
returns; each group shows the mean confidence reported by the API and its
sample count. The rolling buffer is bounded and only contains ticks observed
in the current frontend session. Empty and stale buffers are called out.

These values are descriptive confidence summaries, **not calibration
measurements**: the API does not provide a realised outcome or ground-truth
label against which a prior confidence score can be evaluated. True
calibration requires a versioned outcome contract, including the evaluation
horizon, realised reference value, and the rule for determining whether a
forecast was accurate.

## Observed source band

The min–max envelope is shown only when at least two positive, per-source
prices were explicitly reported for a current WebSocket tick at least as new
as the displayed aggregate. Fallback aggregate prices are marked as
unobserved and are never used to form the band. Data older than five minutes,
future-dated ticks, and missing or insufficient source prices result in an
unavailable state.

The envelope is the observed range of participating source prices, not a
statistical confidence interval or a probabilistic prediction interval. The
WebSocket `sourcePrices` field is optional; when it is absent, the frontend
cannot render a band.

## Confidence-change context

The price detail page compares the previous and latest live confidence scores
and, where both ticks contain the values, identifies simultaneous changes in
contributing sources, observed source spread, and aggregate return. It labels
these as concurrent observations, not causes. Missing history, missing
per-source prices, and stale tick records are disclosed.

The API currently returns the score but no factor attribution. A causal
explanation requires the server to return a validated per-factor breakdown
for both score versions, including stable factor identifiers, observed input
values, signed score contributions, and the score/model version. The frontend
must not infer factor weights from correlations.

## Source-tick export provenance

Price rows can include `sourceTickProvenanceUrl` in the current price payload.
When supplied, the frontend validates that it is a credential-free HTTPS URL,
offers a keyboard-accessible link on the price detail page, and includes the
URL in CSV, JSON, and XLSX price exports. Missing provenance stays empty in
tabular exports and is shown as unavailable in the detail view.

The upstream API must provide a stable URL for the actual source-tick
provenance record (including source/tick identifiers and timestamps). The
frontend does not generate URLs from asset pairs, prices, or timestamps. The
field is optional until the API contract and service implement it.

## In-chart data-quality concern reporting (#859)

Users can report potential price anomalies, sudden spikes, stale feeds, source divergences, or missing ticks directly from any interactive price chart. 

- **Captured Context**: The report dialog pre-populates observed chart context including the target asset pair, observed timestamp, observed price, and contributing oracle sources.
- **Privacy Posture**: Reporter identity is never captured or transmitted. Users may flag evidence as confidential to restrict inspection to verified community stewards and automated triage validators.
- **Workflow Integration**: Submissions enter the moderation triage queue under surface `'chart'` and category `'data-quality'`, allowing auditors to track and investigate reported discrepancies.

