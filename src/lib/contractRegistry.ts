import { StrKey } from '@stellar/stellar-sdk'

/**
 * Networks the on-chain oracle contract can be deployed to.
 * Matches the Soroban network identifiers used across the ecosystem.
 */
export type OracleNetwork = 'mainnet' | 'testnet' | 'futurenet'

export const ORACLE_NETWORKS: readonly OracleNetwork[] = ['mainnet', 'testnet', 'futurenet']

/** A single resolved registry lookup: which contract publishes a given asset on a given network. */
export interface ContractRegistryEntry {
  network: OracleNetwork
  /** Base asset code, e.g. `XLM`, `USDC` — matches the base of a feed pair like `XLM/USD`. */
  asset: string
  /** Soroban contract address (StrKey `C...`) that publishes this asset's price on-chain. */
  contractId: string
}

/** Thrown by registry lookups for a network the registry has never heard of. */
export class UnknownNetworkError extends Error {
  readonly network: string
  constructor(network: string) {
    super(`Unknown oracle network: "${network}". Known networks: ${ORACLE_NETWORKS.join(', ')}`)
    this.name = 'UnknownNetworkError'
    this.network = network
  }
}

/** Thrown by registry lookups for an asset with no published contract on the given network. */
export class UnknownAssetError extends Error {
  readonly network: OracleNetwork
  readonly asset: string
  constructor(network: OracleNetwork, asset: string) {
    super(`No on-chain oracle contract registered for "${asset}" on ${network}`)
    this.name = 'UnknownAssetError'
    this.network = network
    this.asset = asset
  }
}

/** Thrown at module load if a registered address is not a structurally valid Soroban contract address. */
export class InvalidContractAddressError extends Error {
  constructor(network: string, asset: string, contractId: string) {
    super(`Invalid Soroban contract address for ${asset} on ${network}: "${contractId}"`)
    this.name = 'InvalidContractAddressError'
  }
}

type RegistryTable = Record<OracleNetwork, Record<string, string>>

/**
 * Well-known oracle publisher contracts, keyed by network then base asset code.
 *
 * These are the contracts the on-chain layer reads from by default. Addresses are
 * validated (see below) so a typo fails the build immediately rather than surfacing
 * as a confusing runtime error deep in a panel.
 */
const BUILT_IN_REGISTRY: RegistryTable = {
  mainnet: {
    XLM: 'CDSMIA7DB32IJCS6LHH3FWGVERQI7O3MSMEVB5YGGH5PCAQZOD7UIOGA',
    USDC: 'CANJKZBHN7SXCGI3NI5RNU2VZX4OTSICETFNHCU3QQWRL4GAPB6MDBJJ',
  },
  testnet: {
    XLM: 'CA7FLK2OZGSPYFBYXDWCNMSWG7GRZSYDN4OASS4VJXGW3SX3G3GZASP6',
    USDC: 'CCIIMAO7NGSL7YPKWVGO3QCNFPKMC4JP6BYQRSCOPRQKGQMVZHR5OZ7N',
  },
  futurenet: {
    XLM: 'CARBBKWKGW5DKZTHXHZPSDLGBKNVIN3E2QY5ULOVRPADEKEZZRULHEG2',
  },
}

/**
 * Runtime override for local/test deployments, supplied via `VITE_ORACLE_CONTRACT_OVERRIDES`.
 *
 * Expected shape is a JSON object matching {@link RegistryTable} (partial — only the
 * entries being overridden need to be present):
 *
 *   VITE_ORACLE_CONTRACT_OVERRIDES={"testnet":{"XLM":"C...LOCAL"}}
 *
 * Malformed JSON is ignored (with a console warning) rather than crashing the app,
 * since this only ever affects local/test setups.
 */
function readRuntimeOverrides(): Partial<RegistryTable> {
  const raw = import.meta.env.VITE_ORACLE_CONTRACT_OVERRIDES as string | undefined
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('override must be a JSON object')
    }
    return parsed as Partial<RegistryTable>
  } catch (err) {
    console.warn(
      `[contractRegistry] Ignoring malformed VITE_ORACLE_CONTRACT_OVERRIDES: ${err instanceof Error ? err.message : String(err)}`,
    )
    return {}
  }
}

function mergeRegistry(base: RegistryTable, overrides: Partial<RegistryTable>): RegistryTable {
  const merged: RegistryTable = { mainnet: { ...base.mainnet }, testnet: { ...base.testnet }, futurenet: { ...base.futurenet } }
  for (const network of ORACLE_NETWORKS) {
    const overrideForNetwork = overrides[network]
    if (overrideForNetwork) {
      merged[network] = { ...merged[network], ...overrideForNetwork }
    }
  }
  return merged
}

const REGISTRY: RegistryTable = mergeRegistry(BUILT_IN_REGISTRY, readRuntimeOverrides())

/**
 * Fail-fast guard: every registered contract address — built-in or overridden — must be
 * a structurally valid Soroban contract address. Runs once at module load so a typo
 * (in code, or in a deployment's env config) breaks immediately instead of silently
 * rendering a corrupt on-chain state.
 */
for (const network of ORACLE_NETWORKS) {
  for (const [asset, contractId] of Object.entries(REGISTRY[network])) {
    if (!StrKey.isValidContract(contractId)) {
      throw new InvalidContractAddressError(network, asset, contractId)
    }
  }
}

export function isOracleNetwork(value: string): value is OracleNetwork {
  return (ORACLE_NETWORKS as readonly string[]).includes(value)
}

/** Base asset codes with a registered contract on the given network. */
export function listRegisteredAssets(network: OracleNetwork): string[] {
  if (!isOracleNetwork(network)) throw new UnknownNetworkError(network)
  return Object.keys(REGISTRY[network])
}

/**
 * Resolves the registry entry for a network/asset pair — the single source of truth
 * every on-chain panel reads through.
 *
 * @throws {UnknownNetworkError} if `network` is not a recognised Soroban network.
 * @throws {UnknownAssetError} if no contract is registered for `asset` on `network`.
 */
export function getContractRegistryEntry(network: string, asset: string): ContractRegistryEntry {
  if (!isOracleNetwork(network)) throw new UnknownNetworkError(network)

  const code = asset.trim().toUpperCase()
  const contractId = REGISTRY[network][code]
  if (!contractId) throw new UnknownAssetError(network, code)

  return { network, asset: code, contractId }
}

/** Convenience wrapper around {@link getContractRegistryEntry} that returns just the address. */
export function getContractAddress(network: string, asset: string): string {
  return getContractRegistryEntry(network, asset).contractId
}
