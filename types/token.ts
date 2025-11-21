import { PublicKey } from '@solana/web3.js';

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  // description removed
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

export enum LaunchType {
  DIRECT = 'direct',
  METEORA = 'meteora',
}

export interface MeteoraLaunchConfig {
  initialBuyAmount?: number; // Optional initial buy in SOL
  enableFirstBuy: boolean;
}