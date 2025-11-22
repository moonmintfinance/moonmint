/**
 * Token 2022 Atomic Minting Service - WITH REFERRAL SUPPORT
 *
 * Uses proper modern @solana/spl-token-metadata API
 * Correct instruction order with proper space allocation
 * Now includes referral fee splitting
 *
 * FIX: Uses pack() function for accurate metadata size calculation
 * FIX: Uses setAuthority instructions AFTER minting to revoke authorities
 * FIX: Uses metadataUri (JSON metadata) instead of imageUrl in token URI field
 *
 * Fee Structure:
 * - Base fee: 0.08 SOL (45% to platform, 55% to referrer if applicable)
 * - Mint authority: +0.1 SOL (optional)
 * - Freeze authority: +0.1 SOL (optional)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMint,
  getAssociatedTokenAddressSync,
  ExtensionType,
  createInitializeMetadataPointerInstruction,
  getMintLen,
  TYPE_SIZE,
  LENGTH_SIZE,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';
import { TokenMetadata as CustomTokenMetadata, MintConfig } from '@/types/token';
import {
  TRANSACTION_CONFIG,
  SERVICE_FEE_BASE_LAMPORTS,
  SERVICE_FEE_AUTHORITY_LAMPORTS,
} from '@/lib/constants';

/**
 * Atomic Token 2022 Minting Service with On-Chain Metadata & Referral Support
 */
export class AtomicToken2022MintService {
  private readonly connection: Connection;
  private readonly serviceFeeRecipient: PublicKey | undefined;
  private readonly referrerWallet: PublicKey | undefined;

  constructor(
    connection: Connection,
    serviceFeeRecipient?: PublicKey,
    referrerWallet?: PublicKey
  ) {
    this.connection = connection;
    this.serviceFeeRecipient = serviceFeeRecipient;
    this.referrerWallet = referrerWallet;

    if (serviceFeeRecipient) {
      console.log(
        '💰 Service fee recipient configured:',
        serviceFeeRecipient.toBase58()
      );
    } else {
      console.log(
        'ℹ️  No service fee recipient configured - fees will not be deducted'
      );
    }

    if (referrerWallet) {
      console.log(
        '🎯 Referral program active - referrer:',
        referrerWallet.toBase58()
      );
    }
  }

  /**
   * Calculate total service fee based on authorities selected
   */
  calculateTotalServiceFee(config: MintConfig): number {
    let totalFee = SERVICE_FEE_BASE_LAMPORTS;

    if (config.mintAuthority) {
      totalFee += SERVICE_FEE_AUTHORITY_LAMPORTS;
    }

    if (config.freezeAuthority) {
      totalFee += SERVICE_FEE_AUTHORITY_LAMPORTS;
    }

    return totalFee;
  }

  /**
   * Get fee breakdown for display purposes
   */
  getFeeBreakdown(config: MintConfig): {
    base: number;
    authorities: number;
    total: number;
    referrerEarnings?: number;
    platformEarnings?: number;
  } {
    const authoritiesCost =
      (config.mintAuthority ? 1 : 0) + (config.freezeAuthority ? 1 : 0);
    const authoritiesFee = authoritiesCost * SERVICE_FEE_AUTHORITY_LAMPORTS;
    const total = this.calculateTotalServiceFee(config);

    const breakdown: any = {
      base: SERVICE_FEE_BASE_LAMPORTS,
      authorities: authoritiesFee,
      total,
    };

    // Add referral breakdown if referrer exists
    if (this.referrerWallet) {
      const referrerEarnings = Math.floor(total * 0.55); // 55% to referrer
      const platformEarnings = total - referrerEarnings;

      breakdown.referrerEarnings = referrerEarnings;
      breakdown.platformEarnings = platformEarnings;
    }

    return breakdown;
  }

  /**
   * Creates and mints a new Token 2022 with on-chain metadata
   *
   * @param payer - The wallet that will pay for the transaction
   * @param mintKeypair - Keypair for the new mint
   * @param metadata - Token metadata (name, symbol, decimals, supply, metadataUri)
   * @param config - Mint configuration (authorities)
   * @returns Transaction ready to be signed
   */
  async buildMintTransaction(
    payer: PublicKey,
    mintKeypair: Keypair,
    metadata: CustomTokenMetadata,
    config: MintConfig
  ): Promise<Transaction> {
    try {
      const mint = mintKeypair.publicKey;

      console.log('🔑 Mint address:', mint.toBase58());

      // Get associated token account address (using Token 2022 program)
      const associatedTokenAccount = getAssociatedTokenAddressSync(
        mint,
        payer,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log(
        '📦 Associated token account:',
        associatedTokenAccount.toBase58()
      );

      // CRITICAL FIX: Use pack() to get accurate metadata size
      // Create the TokenMetadata object that will be stored
      // ✅ FIXED: Use metadataUri (JSON metadata) instead of imageUrl
      const tokenMetadata: TokenMetadata = {
        mint: mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.metadataUri || metadata.imageUrl || '', // ✅ Use metadataUri first, fallback to imageUrl for backward compatibility
        additionalMetadata: [],
      };

      // Calculate actual packed metadata size using TLV encoding
      const metadataLen = pack(tokenMetadata).length;

      // Size of MetadataExtension header (2 bytes for type, 2 bytes for length)
      const metadataExtension = TYPE_SIZE + LENGTH_SIZE;

      // Space allocation: Only MetadataPointer extension
      const metadataPointerOnlyExtensions = [ExtensionType.MetadataPointer];
      const spaceForAccount = getMintLen(metadataPointerOnlyExtensions);

      // Lamports calculation: Full size (MetadataPointer + metadata data)
      const fullSpace = spaceForAccount + metadataExtension + metadataLen;

      console.log('📊 Space & Lamports Calculation (FIXED):');
      console.log('   Account space (MetadataPointer only):', spaceForAccount, 'bytes');
      console.log('   Metadata length (packed):', metadataLen, 'bytes');
      console.log('   Metadata extension header:', metadataExtension, 'bytes');
      console.log('   Full space (with metadata):', fullSpace, 'bytes');

      // Get minimum balance for FULL space
      const lamports =
        await this.connection.getMinimumBalanceForRentExemption(fullSpace);

      console.log('💰 Required lamports for rent exemption:', lamports);
      console.log(
        '   = Full space (' +
          fullSpace +
          ' bytes) × Rent rate ≈ ' +
          (lamports / LAMPORTS_PER_SOL).toFixed(4) +
          ' SOL'
      );
      console.log(
        '   ℹ️  Account allocated with',
        spaceForAccount,
        'bytes, but has lamports for',
        fullSpace,
        'bytes (covers metadata realloc)'
      );

      // Calculate total service fee based on authorities
      const totalServiceFee = this.calculateTotalServiceFee(config);
      const feeBreakdown = this.getFeeBreakdown(config);

      console.log('💳 Service fee breakdown:');
      console.log(
        '   Base fee:',
        (feeBreakdown.base / LAMPORTS_PER_SOL).toFixed(4),
        'SOL'
      );
      if (config.mintAuthority) {
        console.log(
          '   Mint authority:',
          (SERVICE_FEE_AUTHORITY_LAMPORTS / LAMPORTS_PER_SOL).toFixed(4),
          'SOL'
        );
      }
      if (config.freezeAuthority) {
        console.log(
          '   Freeze authority:',
          (SERVICE_FEE_AUTHORITY_LAMPORTS / LAMPORTS_PER_SOL).toFixed(4),
          'SOL'
        );
      }
      console.log(
        '   Total fee:',
        (totalServiceFee / LAMPORTS_PER_SOL).toFixed(4),
        'SOL'
      );

      if (this.referrerWallet && feeBreakdown.referrerEarnings) {
        console.log('🎯 Referral split:');
        console.log(
          '   Platform (70%):',
          (feeBreakdown.platformEarnings! / LAMPORTS_PER_SOL).toFixed(4),
          'SOL'
        );
        console.log(
          '   Referrer (30%):',
          (feeBreakdown.referrerEarnings / LAMPORTS_PER_SOL).toFixed(4),
          'SOL'
        );
      }

      // Build transaction using private method
      const transaction = await this.buildAtomicMintTransaction(
        payer,
        mint,
        associatedTokenAccount,
        spaceForAccount,
        lamports,
        metadata,
        config,
        totalServiceFee
      );

      return transaction;
    } catch (error) {
      console.error('❌ Error building mint transaction:', error);
      throw error;
    }
  }

  /**
   * Builds atomic transaction with CORRECT instruction order
   * Now includes referral fee splitting
   *
   * PROPER ORDER for Token 2022 with Metadata & Referral:
   * 1. Fee transfer to platform (optional)
   * 2. Fee transfer to referrer (optional)
   * 3. Create account (space=MetadataPointer only, lamports=full size)
   * 4. Initialize MetadataPointer extension
   * 5. Initialize Mint2 (with authorities set to payer initially)
   * 6. Initialize Metadata (reallocates account using pre-funded lamports)
   * 7. Create ATA
   * 8. Mint tokens
   * 9. Revoke mint authority (if requested) using setAuthority
   * 10. Revoke freeze authority (if requested) using setAuthority
   */
  private async buildAtomicMintTransaction(
    payer: PublicKey,
    mint: PublicKey,
    associatedTokenAccount: PublicKey,
    space: number,
    lamports: number,
    metadata: CustomTokenMetadata,
    config: MintConfig,
    totalServiceFee: number
  ): Promise<Transaction> {
    const transaction = new Transaction();

    // Calculate fee split
    const referrerEarnings = this.referrerWallet
      ? Math.floor(totalServiceFee * 0.55)
      : 0;
    const platformEarnings = totalServiceFee - referrerEarnings;

    // Step 1: Platform Fee Transfer
    if (this.serviceFeeRecipient && platformEarnings > 0) {
      console.log(
        '💳 [1] Adding platform fee:',
        platformEarnings,
        'lamports to',
        this.serviceFeeRecipient.toBase58()
      );

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: this.serviceFeeRecipient,
          lamports: platformEarnings,
        })
      );
    }

    // Step 2: Referrer Fee Transfer
    if (this.referrerWallet && referrerEarnings > 0) {
      console.log(
        '🎯 [2] Adding referral fee:',
        referrerEarnings,
        'lamports to',
        this.referrerWallet.toBase58()
      );

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: this.referrerWallet,
          lamports: referrerEarnings,
        })
      );
    }

    // Step 3: Create mint account with MetadataPointer extension space only
    // BUT with lamports for full size (including metadata)
    const stepNum = this.referrerWallet ? 3 : 2;
    console.log(`📋 [${stepNum}] Creating mint account with space:`, space, 'bytes, lamports:', lamports);
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mint,
        space,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      })
    );

    // Step 4: Initialize MetadataPointer extension
    const step4 = stepNum + 1;
    console.log(`🔧 [${step4}] Initializing metadata pointer extension`);
    transaction.add(
      createInitializeMetadataPointerInstruction(
        mint,
        payer,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Step 5: Initialize Mint2 with authorities (will be revoked later if needed)
    const step5 = step4 + 1;
    console.log(`🔧 [${step5}] Initializing Token 2022 mint with temporary authorities`);
    transaction.add(
      createInitializeMint2Instruction(
        mint,
        metadata.decimals,
        payer, // Set initially, will revoke later if config.mintAuthority is false
        payer, // Set initially, will revoke later if config.freezeAuthority is false
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Step 6: Initialize Metadata
    // ✅ CRITICAL FIX: Use metadataUri (JSON metadata) instead of imageUrl
    const step6 = step5 + 1;
    console.log(`📝 [${step6}] Initializing metadata with URI`);
    transaction.add(
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        mint: mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.metadataUri || metadata.imageUrl || '', // ✅ Use metadataUri (JSON) first, fallback to imageUrl for backward compatibility
        mintAuthority: payer,
        updateAuthority: payer,
      })
    );

    // Step 7: Create associated token account
    const step7 = step6 + 1;
    console.log(`📦 [${step7}] Creating associated token account`);
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        associatedTokenAccount,
        payer,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    // Step 8: Mint initial supply (if specified)
    if (metadata.initialSupply > 0) {
      const amount =
        BigInt(metadata.initialSupply) *
        BigInt(10 ** metadata.decimals);

      const step8 = step7 + 1;
      console.log(
        `🪙 [${step8}] Minting`,
        metadata.initialSupply,
        metadata.symbol,
        'tokens'
      );
      transaction.add(
        createMintToInstruction(
          mint,
          associatedTokenAccount,
          payer,
          amount,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    // Step 9: Revoke mint authority if requested
    const step9 = metadata.initialSupply > 0 ? step7 + 2 : step7 + 1;
    if (config.mintAuthority) {
      console.log(`🔒 [${step9}] Revoking mint authority (setting to null)`);
      transaction.add(
        createSetAuthorityInstruction(
          mint,
          payer,
          AuthorityType.MintTokens,
          null,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );
    } else {
      console.log(`✓ [${step9}] Mint authority retained`);
    }

    // Step 10: Revoke freeze authority if requested
    const step10 = step9 + 1;
    if (config.freezeAuthority) {
      console.log(`🔒 [${step10}] Revoking freeze authority (setting to null)`);
      transaction.add(
        createSetAuthorityInstruction(
          mint,
          payer,
          AuthorityType.FreezeAccount,
          null,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );
    } else {
      console.log(`✓ [${step10}] Freeze authority retained`);
    }

    console.log('✅ Token 2022 with on-chain metadata configured');
    console.log('📋 Metadata stored directly in mint account:');
    console.log('   Name:', metadata.name);
    console.log('   Symbol:', metadata.symbol);
    console.log('   Decimals:', metadata.decimals);
    console.log('   Metadata URI:', metadata.metadataUri || metadata.imageUrl || '(none)'); // ✅ Updated log
    console.log('   Mint authority:', config.mintAuthority ? 'RETAINED' : 'REVOKED');
    console.log('   Freeze authority:', config.freezeAuthority ? 'RETAINED' : 'REVOKED');
    console.log('💡 Fixed: Using pack() for accurate metadata size!');
    console.log('💡 Fixed: Using setAuthority to revoke authorities after mint!');
    console.log('💡 Fixed: Using metadataUri (JSON) instead of imageUrl!'); // ✅ New log
    if (this.referrerWallet) {
      console.log('🎯 Referral: Fee split enabled (45/55)!');
    }

    return transaction;
  }

  /**
   * Validates transaction completion
   */
  async validateMintCreation(mintAddress: string): Promise<boolean> {
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      const mintInfo = await getMint(
        this.connection,
        mintPublicKey,
        TRANSACTION_CONFIG.COMMITMENT,
        TOKEN_2022_PROGRAM_ID
      );

      if (mintInfo) {
        console.log('✅ Mint validation successful');
        console.log('📊 Mint info:', {
          supply: mintInfo.supply.toString(),
          decimals: mintInfo.decimals,
          isInitialized: mintInfo.isInitialized,
          mintAuthority: mintInfo.mintAuthority?.toBase58() || 'null (revoked)',
          freezeAuthority: mintInfo.freezeAuthority?.toBase58() || 'null (revoked)',
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Validation failed:', error);
      return false;
    }
  }
}