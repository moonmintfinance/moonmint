import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  DynamicBondingCurveClient,
  deriveDbcPoolAddress
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { NATIVE_MINT } from '@solana/spl-token';
import { BN } from '@project-serum/anchor';
import { TokenMetadata, MintConfig } from '@/types/token';
import { METEORA_CONFIG, TRANSACTION_CONFIG } from '@/lib/constants';

export interface MeteoraLaunchParams {
  metadata: TokenMetadata;
  config: MintConfig;
  initialBuyAmountSol?: number;
}

export interface MeteoraLaunchResult {
  transactions: Transaction[];
  mintKeypair: Keypair;
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
   * Initialize Meteora DBC Client
   * ✅ FIXED: DynamicBondingCurveClient expects (connection, commitment) not a provider
   */
  private async initClient() {
    if (
      !this.wallet.publicKey ||
      !this.wallet.signTransaction ||
      !this.wallet.signAllTransactions
    ) {
      throw new Error('Wallet not connected');
    }

    try {
      // ✅ DynamicBondingCurveClient only needs connection and commitment
      // It handles provider creation internally
      this.client = new DynamicBondingCurveClient(
        this.connection,
        TRANSACTION_CONFIG.COMMITMENT
      );
      console.log('✅ Meteora DBC Client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Meteora client:', error);
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
   *
   * Returns 2 transactions:
   * 1. Pool creation transaction (requires mint keypair signature)
   * 2. Swap/buy transaction (Phantom signature only)
   *
   * Client should:
   * 1. Call signAllTransactions() with both transactions
   * 2. Add mint keypair signature to transaction[0] only
   * 3. Send both fully signed transactions
   */
  async launchToken(params: MeteoraLaunchParams): Promise<MeteoraLaunchResult> {
    this.validateConfig();
    await this.initClient();

    if (!this.client || !this.wallet.publicKey) {
      throw new Error('Failed to initialize Meteora Client');
    }

    const { metadata, initialBuyAmountSol = 0 } = params;
    const payer = this.wallet.publicKey;

    console.log('🚀 Launching token on Meteora bonding curve...');

    // 1. Generate mint keypair (SDK will create it)
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;

    console.log('📍 Mint address:', mint.toBase58());
    console.log('💳 Payer:', payer.toBase58());
    console.log('🪙 Token details:');
    console.log('   Name:', metadata.name);
    console.log('   Symbol:', metadata.symbol);
    console.log('   Decimals:', metadata.decimals);
    console.log('   Supply:', metadata.initialSupply.toLocaleString());

    // 2. Prepare First Buy Parameters (if specified)
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
        minimumAmountOut: new BN(1),
        referralTokenAccount: null,
      };

      console.log(
        `💰 First buy: ${initialBuyAmountSol} SOL (${amountIn.toString()} lamports)`
      );
    }

    // 3. Get config key
    const configKey = new PublicKey(METEORA_CONFIG.CONFIG_KEY);

    // 4. Derive pool address
    const poolAddress = deriveDbcPoolAddress(NATIVE_MINT, mint, configKey);
    console.log('🌊 Pool address (derived):', poolAddress.toBase58());

    // 5. Use SDK's createPoolWithFirstBuy - it handles mint creation!
    console.log('🌊 Creating Meteora bonding curve pool...');

    try {
      const poolTxResult = await this.client.pool.createPoolWithFirstBuy({
        createPoolParam: {
          baseMint: mint,
          config: configKey,
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.metadataUri || metadata.imageUrl || '',
          payer: payer,
          poolCreator: payer,
        },
        firstBuyParam: firstBuyParam,
      });

      console.log('✅ Pool transactions created by SDK');

      // ========================================================================
      // Prepare transactions for client signing
      // ========================================================================
      const txsToSign: Transaction[] = [];
      const { blockhash } = await this.connection.getLatestBlockhash(
        TRANSACTION_CONFIG.COMMITMENT
      );

      // ✅ ADD PRIORITY FEE
      // 200,000 microLamports = 0.0002 SOL max priority fee
      // Essential for mainnet inclusion during congestion
      const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 200000,
      });

      // STEP 1: Prepare pool creation transaction
      const poolTx = poolTxResult.createPoolTx;
      poolTx.add(priorityFeeIx); // Prepend priority fee
      poolTx.feePayer = payer;
      poolTx.recentBlockhash = blockhash;

      console.log('📝 Pool creation transaction prepared for Phantom signing');
      txsToSign.push(poolTx);

      // STEP 2: Prepare swap/buy transaction (if applicable)
      if (poolTxResult.swapBuyTx) {
        const swapTx = poolTxResult.swapBuyTx;
        swapTx.add(priorityFeeIx); // Prepend priority fee
        swapTx.feePayer = payer;
        swapTx.recentBlockhash = blockhash;

        console.log('📝 Swap/buy transaction prepared for Phantom signing');
        txsToSign.push(swapTx);
      }

      console.log(
        `✅ Prepared ${txsToSign.length} transaction(s) for client signing`
      );

      return {
        transactions: txsToSign,
        mintKeypair,  // Client will sign this on pool creation tx only
        mintAddress: mint.toBase58(),
        poolAddress: poolAddress.toBase58(),
      };
    } catch (error) {
      console.error('❌ Error creating pool with SDK:', error);
      throw error;
    }
  }
}