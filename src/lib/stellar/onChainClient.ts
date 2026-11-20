import { Horizon, SorobanRpc } from '@stellar/stellar-sdk';
import type { OracleNetwork } from '../networkRegistry';

/**
 * Single source of truth for network identifiers.
 *
 * `StellarNetwork` is an alias of the registry's `OracleNetwork` so that the
 * on-chain client and the network registry can never drift apart. Callers may
 * keep using either name, but they refer to the exact same union.
 */
export type StellarNetwork = OracleNetwork;

export interface OnChainClientConfig {
  network: StellarNetwork;
  horizonUrl?: string;
  sorobanUrl?: string;
}

const NETWORK_ENDPOINTS: Record<StellarNetwork, { horizon: string; soroban: string }> = {
  mainnet: {
    horizon: 'https://horizon.stellar.org',
    soroban: 'https://soroban-rpc.stellar.org',
  },
  testnet: {
    horizon: 'https://horizon-testnet.stellar.org',
    soroban: 'https://soroban-testnet.stellar.org',
  },
  futurenet: {
    horizon: 'https://horizon-futurenet.stellar.org',
    soroban: 'https://rpc-futurenet.stellar.org',
  },
};

export function resolveNetworkEndpoints(network: StellarNetwork): { horizon: string; soroban: string } {
  return NETWORK_ENDPOINTS[network];
}

export class OnChainClient {
  readonly network: StellarNetwork;
  readonly horizon: Horizon.Server;
  readonly soroban: SorobanRpc.Server;

  constructor(config: OnChainClientConfig) {
    const endpoints = resolveNetworkEndpoints(config.network);
    this.network = config.network;
    this.horizon = new Horizon.Server(config.horizonUrl ?? endpoints.horizon);
    this.soroban = new SorobanRpc.Server(config.sorobanUrl ?? endpoints.soroban);
  }
}
