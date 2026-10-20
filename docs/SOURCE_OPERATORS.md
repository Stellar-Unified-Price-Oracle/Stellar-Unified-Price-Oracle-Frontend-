# Oracle Source Operators & Provenance

This document outlines the identity, cryptographic verification, and provenance architecture for oracle sources integrated into the Stellar Unified Price Oracle.

## Overview

In decentralized price feeds, evaluating oracle reliability requires insight into:
1. **Operator Identity**: Who operates the infrastructure publishing the feed?
2. **Cryptographic Provenance**: How is data signed and authenticated from origin to on-chain commitment?
3. **Audit & Compliance**: Has the signing mechanism or smart contract passed third-party security audits?

## Source Detail Views & Operator Identity

The `SourceHistoryDrilldown` component provides operator and provenance details for individual oracle sources:

- **Organization / Entity**: Entity operating the oracle node.
- **Verification Tier**:
  - `Verified Operator`: Known institutional or protocol operator with verified on-chain signing key.
  - `Registered Entity`: Registered legal organization with audited feed pipelines.
  - `Community Node`: Independent node operator or validator.
  - `Unverified Operator`: Feed without verified on-chain credentials.
- **Operator Address**: Public Stellar address (`G...`) associated with the operator.
- **Signing Algorithm**: Cryptographic signature algorithm (standardized on `Ed25519`).
- **Node Endpoint / Gateway**: Domain or public endpoint publishing feed metrics.
- **Provenance & Ingestion Method**: Ingestion architecture (e.g. multi-node quorum, Soroban native smart contract emitter, Cosmos BandChain bridge, Wormhole VAA).
- **Audit Status**: Security audit attestation.

## Handling Unreported or Unavailable Data

In alignment with project principles:
- **No Data Fabrication**: The UI never invents operator identities, keys, or endpoints.
- **Explicit Fallbacks**: Feeds lacking registered credentials explicitly display "Operator identity not reported by API" and "Source-tick provenance unavailable from the API" rather than displaying blank fields or assumed defaults.
