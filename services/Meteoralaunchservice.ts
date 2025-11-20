/**
 * Meteora Bonding Curve Launch Service
 * Integrates with Meteora DBC SDK to launch tokens on bonding curves
 */

import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  DynamicBondingCurveClient,
  deriveDbcPoolAddress
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { WalletContextState } from '@solana/wallet-adapter-react';
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  ExtensionType,
  createInitializeMetadataPointerInstruction,
  getMintLen,
  createSetAuthorityInstruction,
  AuthorityType,
  NATIVE_MINT,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  pack,
  TokenMetadata as SplTokenMetadata,
} from '@solana/spl-token-metadata';
import { BN } from '@project-serum/anchor';
import { TokenMetadata, MintConfig } from '@/types/token';
import { METEORA_CONFIG, TRANSACTION_CONFIG } from '@/lib/constants';

export interface MeteoraLaunchParams {
  metadata: TokenMetadata;
  config: MintConfig;
  initialBuyAmountSol?: number;
}

export interface MeteoraLaunchResult {
  transaction: Transaction;
  mintAddress: string;
  poolAddress: string;
}

/**
 * Helper to prepare swap amount parameters
 */
async function prepareSwapAmountParam(
  amount: number,
  mint: PublicKey,
  connection: Connection
): Promise<BN> {
  if (mint.equals(NATIVE_MINT)) {
    return new BN(amount * LAMPORTS_PER_SOL);
  }

  // For non-SOL tokens, adjust based on decimals
  // For now, assume 9 decimals (adjust if needed)
  return new BN(amount * Math.pow(10, 9));
}

export class MeteoraLaunchService {
  private client: DynamicBondingCurveClient | null = null;

  constructor(
    private connection: Connection,
    private wallet: WalletContextState
  ) {}

  /**
   * Initialize Meteora DBC Client with proper typing
   */
  private async initClient() {
    if (
      !this.wallet.publicKey ||
      !this.wallet.signTransaction ||
      !this.wallet.signAllTransactions
    ) {
      throw new Error('Wallet not connected');
    }

    // Create properly typed anchor wallet
    const anchorWallet = {
      publicKey: this.wallet.publicKey,
      signTransaction: this.wallet.signTransaction.bind(this.wallet),
      signAllTransactions: this.wallet.signAllTransactions.bind(this.wallet),
    };

    try {
      // @ts-ignore - SDK type compatibility with wallet adapter
      this.client = new DynamicBondingCurveClient(
        this.connection,
        anchorWallet
      );
      console.log('✅ Meteora DBC Client initialized');
    } catch (error) {
      console.error('Failed to initialize Meteora client:', error);
      throw new Error('Failed to initialize Meteora DBC Client');
    }
  }

  /**
   * Validate Meteora configuration
   */
  private validateConfig(): void {
    if (!METEORA_CONFIG.ENABLED || !METEORA_CONFIG.CONFIG_KEY) {
      throw new Error(
        'Meteora bonding curves not configured. Please set NEXT_PUBLIC_METEORA_CONFIG_KEY in your environment variables.'
      );
    }
  }

  /**
   * Launch token on Meteora bonding curve
   */
  async launchToken(params: MeteoraLaunchParams): Promise<MeteoraLaunchResult> {
    this.validateConfig();
    await this.initClient();

    if (!this.client || !this.wallet.publicKey) {
      throw new Error('Failed to initialize Meteora Client');
    }

    const { metadata, config, initialBuyAmountSol = 0 } = params;
    const payer = this.wallet.publicKey;

    console.log('🚀 Launching token on Meteora bonding curve...');

    // 1. Create Token Mint
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;

    console.log('📍 Mint address:', mint.toBase58());
    console.log('💳 Payer:', payer.toBase58());

    // 2. Build Token Creation Transaction
    const mintTx = await this.createTokenTransaction(
      payer,
      mintKeypair,
      metadata,
      config
    );

    // 3. Prepare First Buy Parameters (if specified)
    let firstBuyParam = undefined;
    if (initialBuyAmountSol > 0) {
      const amountIn = await prepareSwapAmountParam(
        initialBuyAmountSol,
        NATIVE_MINT,
        this.connection
      );

      firstBuyParam = {
        buyer: payer,
        buyAmount: amountIn,
        minimumAmountOut: new BN(1), // Minimum 1 token out
        referralTokenAccount: null,
      };

      console.log(
        `💰 First buy: ${initialBuyAmountSol} SOL (${amountIn.toString()} lamports)`
      );
    }

    // 4. Get config key
    const configKey = new PublicKey(METEORA_CONFIG.CONFIG_KEY);

    // 5. Derive pool address BEFORE creating the pool
    const poolAddress = deriveDbcPoolAddress(NATIVE_MINT, mint, configKey);

    console.log('🌊 Pool address (derived):', poolAddress.toBase58());
    console.log('🌊 Creating Meteora bonding curve pool...');

    // 6. Create Meteora Pool + Optional First Buy
    const poolTxResult = await this.client.pool.createPoolWithFirstBuy({
      createPoolParam: {
        baseMint: mint,
        config: configKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.imageUrl || '',
        payer: payer,
        poolCreator: payer,
      },
      firstBuyParam: firstBuyParam,
    });

    // 7. Combine All Transactions
    const finalTx = new Transaction();

    // Add mint creation instructions FIRST (mint must exist before pool creation)
    finalTx.add(...mintTx.instructions);

    // Add pool creation instructions
    finalTx.add(...poolTxResult.createPoolTx.instructions);

    // Add swap buy instructions (if applicable)
    if (poolTxResult.swapBuyTx) {
      finalTx.add(...poolTxResult.swapBuyTx.instructions);
      console.log('✅ First buy included in transaction');
    }

    // Set transaction metadata
    finalTx.feePayer = payer;
    const { blockhash } = await this.connection.getLatestBlockhash(
      TRANSACTION_CONFIG.COMMITMENT
    );
    finalTx.recentBlockhash = blockhash;

    // Partially sign with mint keypair
    finalTx.partialSign(mintKeypair);

    console.log(
      `📝 Transaction built with ${finalTx.instructions.length} instructions`
    );

    return {
      transaction: finalTx,
      mintAddress: mint.toBase58(),
      poolAddress: poolAddress.toBase58(),
    };
  }

  /**
   * Create Token 2022 with metadata
   */
  private async createTokenTransaction(
    payer: PublicKey,
    mintKeypair: Keypair,
    metadata: TokenMetadata,
    config: MintConfig
  ): Promise<Transaction> {
    const mint = mintKeypair.publicKey;
    const decimals = metadata.decimals;
    const supply = metadata.initialSupply;
    const amount = BigInt(supply) * BigInt(10 ** decimals);

    console.log('🪙 Token details:');
    console.log('   Name:', metadata.name);
    console.log('   Symbol:', metadata.symbol);
    console.log('   Decimals:', decimals);
    console.log('   Supply:', supply.toLocaleString());

    const transaction = new Transaction();

    // Build Token Metadata
    const tokenMetadata: SplTokenMetadata = {
      mint: mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.imageUrl || '',
      additionalMetadata: [],
    };

    // Calculate space requirements
    const metadataLen = pack(tokenMetadata).length;
    const metadataExtension = 4; // TYPE_SIZE + LENGTH_SIZE
    const spaceForAccount = getMintLen([ExtensionType.MetadataPointer]);
    const fullSpace = spaceForAccount + metadataExtension + metadataLen;
    const lamports =
      await this.connection.getMinimumBalanceForRentExemption(fullSpace);

    console.log('📊 Space allocation:');
    console.log('   Account space:', spaceForAccount, 'bytes');
    console.log('   Metadata length:', metadataLen, 'bytes');
    console.log('   Full space:', fullSpace, 'bytes');
    console.log('   Rent:', (lamports / LAMPORTS_PER_SOL).toFixed(4), 'SOL');

    // Get associated token account
    const ata = getAssociatedTokenAddressSync(
      mint,
      payer,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // 1. Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mint,
        space: fullSpace,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      })
    );

    // 2. Initialize metadata pointer
    transaction.add(
      createInitializeMetadataPointerInstruction(
        mint,
        payer,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // 3. Initialize mint
    transaction.add(
      createInitializeMint2Instruction(
        mint,
        decimals,
        payer, // Mint authority (will be revoked if config.mintAuthority = true)
        payer, // Freeze authority (will be revoked if config.freezeAuthority = true)
        TOKEN_2022_PROGRAM_ID
      )
    );

    // 4. Initialize metadata
    transaction.add(
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        mint: mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.imageUrl || '',
        mintAuthority: payer,
        updateAuthority: payer,
      })
    );

    // 5. Create associated token account
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        ata,
        payer,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // 6. Mint initial supply
    if (supply > 0) {
      transaction.add(
        createMintToInstruction(
          mint,
          ata,
          payer,
          amount,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );
      console.log('✅ Minting initial supply to creator');
    }

    // 7. Revoke mint authority (if requested)
    if (config.mintAuthority) {
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
      console.log('🔒 Mint authority will be revoked');
    }

    // 8. Revoke freeze authority (if requested)
    if (config.freezeAuthority) {
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
      console.log('🔒 Freeze authority will be revoked');
    }

    return transaction;
  }
}