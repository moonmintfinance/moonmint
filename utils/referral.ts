import { PublicKey } from '@solana/web3.js';

/**
 * Referral Program Utilities
 * Handles referral tracking, validation, and link generation
 */

/**
 * Gets referral wallet from URL parameters
 * Returns the wallet address if valid, null otherwise
 */
export function getReferralWallet(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');

  if (!ref) return null;

  // Validate it's a proper wallet address
  if (isValidReferralWallet(ref)) {
    return ref;
  }

  return null;
}

/**
 * Validates if a string is a valid Solana wallet address
 */
export function isValidReferralWallet(wallet: string): boolean {
  if (!wallet || typeof wallet !== 'string') {
    return false;
  }

  try {
    new PublicKey(wallet);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates referral link for a wallet
 * Example: https://yourapp.com?ref=walletaddress
 */
export function generateReferralLink(walletAddress: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const baseUrl = window.location.origin;
  return `${baseUrl}?ref=${walletAddress}`;
}

/**
 * Calculates referral earnings (30% of total service fee)
 * Referrers get 30% cut of all fees from their referrals
 */
export function calculateReferralEarnings(totalServiceFeeLamports: number): number {
  return Math.floor(totalServiceFeeLamports * 0.55); // 55% to referrer
}

/**
 * Gets the percentage cut for referrers
 */
export function getReferralPercentage(): number {
  return 55; // 55%
}

/**
 * Splits fee between main wallet and referrer
 */
export function splitFees(
  totalFee: number,
  referrerWallet?: PublicKey
): { mainWalletShare: number; referrerShare: number } {
  if (!referrerWallet) {
    return { mainWalletShare: totalFee, referrerShare: 0 };
  }

  const referrerShare = calculateReferralEarnings(totalFee);
  const mainWalletShare = totalFee - referrerShare;

  return { mainWalletShare, referrerShare };
}

/**
 * Formats referral earnings for display
 */
export function formatReferralEarnings(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return sol.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 9,
  });
}