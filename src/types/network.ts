/**
 * Single source of truth for network identifiers.
 *
 * Both the network registry (`OracleNetwork`) and the on-chain client
 * (`StellarNetwork`) previously declared their own enums. They are now
 * aliases of the same union so values are interchangeable and a mismatch
 * can no longer be passed across module boundaries.
 */
export type NetworkId = 'mainnet' | 'testnet' | 'futurenet';

/** Network identifiers used by the oracle network registry. */
export type OracleNetwork = NetworkId;

/** Network identifiers used by the on-chain Stellar client. */
export type StellarNetwork = NetworkId;

export const NETWORK_IDS: readonly NetworkId[] = ['mainnet', 'testnet', 'futurenet'];

export function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === 'string' && (NETWORK_IDS as readonly string[]).includes(value);
}
