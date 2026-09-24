/**
 * Small on-chain client module — the one place UI panels go through to read
 * published prices from the Soroban oracle contracts.
 *
 * Every panel resolves its contract address through {@link contractRegistry}
 * rather than hardcoding one, and fetches through this module rather than
 * calling `api/rest.ts` directly, so the network default and error shape stay
 * consistent across every on-chain surface in the app.
 */
import { config } from '../config'
import { fetchOnChainPrice as fetchOnChainPriceFromApi } from '../api/rest'
import type { OnChainPriceRecord } from '../types/onchain'
import {
  getContractRegistryEntry,
  isOracleNetwork,
  type ContractRegistryEntry,
  type OracleNetwork,
} from './contractRegistry'

/** The network on-chain panels read from unless a caller overrides it. */
export function getActiveNetwork(): OracleNetwork {
  return isOracleNetwork(config.oracleNetwork) ? config.oracleNetwork : 'testnet'
}

/**
 * Resolves the active registry entry for an asset — the (network, contract, asset)
 * triple that on-chain status UI renders. Delegates to {@link getContractRegistryEntry},
 * so unknown networks/assets raise the same typed errors documented there.
 */
export function getActiveRegistryEntry(asset: string, network: OracleNetwork = getActiveNetwork()): ContractRegistryEntry {
  return getContractRegistryEntry(network, asset)
}

/**
 * Reads the latest on-chain published price for an asset.
 *
 * @param asset - Base asset code, e.g. `XLM` (case-insensitive).
 * @param network - Defaults to {@link getActiveNetwork}.
 */
export function fetchOnChainPrice(
  asset: string,
  network: OracleNetwork = getActiveNetwork(),
  signal?: AbortSignal,
): Promise<OnChainPriceRecord> {
  // Resolves first so an unknown asset/network fails fast with a typed error
  // instead of reaching the network.
  const entry = getActiveRegistryEntry(asset, network)
  return fetchOnChainPriceFromApi(entry.network, entry.asset, signal)
}
