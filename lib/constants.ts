import { clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Solana network configuration
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';

// RPC Endpoint - uses proxy on client, direct on server
export const SOLANA_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  (typeof window !== 'undefined'
    ? '/api/rpc' // Client-side: use local RPC proxy
    : `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` // Server-side: direct Helius
  );

// Service fee configuration
export const SERVICE_FEE_BASE_SOL = 0.08; // Base service fee
export const SERVICE_FEE_AUTHORITY_SOL = 0.1; // Fee per authority (freeze or mint)
export const SERVICE_FEE_BASE_LAMPORTS = SERVICE_FEE_BASE_SOL * LAMPORTS_PER_SOL;
export const SERVICE_FEE_AUTHORITY_LAMPORTS =
  SERVICE_FEE_AUTHORITY_SOL * LAMPORTS_PER_SOL;

// Service fee recipient wallet address
export const SERVICE_FEE_WALLET = process.env.NEXT_PUBLIC_SERVICE_FEE_WALLET || '';

// Token validation constraints
export const TOKEN_CONSTRAINTS = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 32,
  MIN_SYMBOL_LENGTH: 1,
  MAX_SYMBOL_LENGTH: 10,
  MIN_DECIMALS: 0,
  MAX_DECIMALS: 9,
  MIN_SUPPLY: 0,
  MAX_SUPPLY: Number.MAX_SAFE_INTEGER,
};

// Transaction configuration
export const TRANSACTION_CONFIG = {
  COMMITMENT: 'confirmed' as const,
  PREFLIGHT_COMMITMENT: 'processed' as const,
  MAX_RETRIES: 3,
  TIMEOUT: 60000, // 60 seconds
};

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 5000,
  ANIMATION_DURATION: 300,
};

// Token 2022 Configuration
export const TOKEN_2022_CONFIG = {
  PROGRAM_ID: 'TokenzQdBbjWhAwr8QCZiifKLMquaXaNeP2namQKvvu', // Token 2022 Program ID
  ENABLE_METADATA_POINTER: true, // Use metadata pointer extension
  ON_CHAIN_METADATA: true, // Store all metadata on-chain
};