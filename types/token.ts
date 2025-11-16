import { PublicKey } from '@solana/web3.js';

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  description?: string;
  imageUrl?: string;
}

export interface MintConfig {
  freezeAuthority: boolean;
  mintAuthority: boolean;
}

export interface MintResult {
  success: boolean;
  mintAddress?: string;
  tokenAccount?: string;
  signature?: string;
  error?: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  errors: string[];
}