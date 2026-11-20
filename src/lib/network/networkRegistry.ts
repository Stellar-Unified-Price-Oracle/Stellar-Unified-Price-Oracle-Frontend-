export type OracleNetwork = 'mainnet' | 'testnet' | 'futurenet';

/**
 * Single source of truth for network identifiers.
 *
 * `StellarNetwork` is the canonical network type used by the on-chain client.
 * `OracleNetwork` is kept as an alias so the network registry and the on-chain
 * client agree on the exact same set of identifiers (no drift, no TS2322).
 */
export type StellarNetwork = OracleNetwork;

export interface NetworkConfig {
  network: OracleNetwork;
  horizonUrl: string;
  sorobanRpcUrl: string;
  passphrase: string;
}

export const NETWORK_CONFIGS: Record<OracleNetwork, NetworkConfig> = {
  mainnet: {
    network: 'mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban-rpc.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
  testnet: {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
  },
  futurenet: {
    network: 'futurenet',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
    passphrase: 'Test SDF Future Network ; October 2022',
  },
};

export const DEFAULT_NETWORK: OracleNetwork = 'testnet';

export function getNetworkConfig(network: OracleNetwork): NetworkConfig {
  return NETWORK_CONFIGS[network];
}

export function isOracleNetwork(value: string): value is OracleNetwork {
  return value === 'mainnet' || value === 'testnet' || value === 'futurenet';
}
