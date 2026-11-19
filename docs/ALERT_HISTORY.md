# Alert history and audit exports

The alert history in the dashboard is a browser-local record of alert events
observed by the frontend. It is not fetched from an upstream service, synced
between accounts, or independently verified by a server. No backend/API change
is required for these exports; a server-backed audit trail would require a
separate API contract and durable server-side event source.

The browser stores at most the 500 most recent entries. When the limit is
reached, older events may have been discarded. Clearing history removes the
local history and its time-series mirror. The dashboard says when browser
storage is unavailable or saved data cannot be read, rather than treating
either case as proof that no alerts fired.

## Retention and compaction limits

Long-term retention is bounded by explicit limits, and the UI states them
rather than implying history is kept forever:

- **Entry cap:** at most 500 history entries are retained. Once the cap is
  reached, the oldest entries are compacted away (dropped) to make room for new
  events. The dashboard surfaces that older events may be missing once the cap
  is hit.
- **Time-series mirror:** the mirrored series is compacted alongside the
  history so it does not grow without bound; clearing history clears the mirror
  too.
- **Storage availability:** if browser storage is unavailable or saved data
  cannot be read, the dashboard reports that state explicitly instead of
  showing an empty history as if no alerts fired.

These limits are the contract for retention. Anything older than the retained
window is not recoverable from the browser and is not reconstructed or
inferred. A longer or server-backed retention window would require a separate
API contract and durable server-side event source.

## Export formats

CSV and JSON exports contain the currently filtered history entries, not
entries hidden by the asset-pair search. Both include stable event and alert
IDs, the firing time as an ISO-8601 UTC timestamp (with `Z`), price, condition,
alert type, event kind, threshold fields, and available escalation/retest
metadata. Null metadata remains empty/null instead of being inferred.

JSON wraps the records in a versioned envelope with `schemaVersion`,
`source: "browser-local"`, and `exportedAtUtc`. Export errors are announced in
the UI and do not produce a success message. The visible timestamps also use
UTC ISO-8601 so display and downloaded records have the same time basis.

The export represents the frontend's locally retained records only. It should
not be used as a complete or tamper-evident audit log.
