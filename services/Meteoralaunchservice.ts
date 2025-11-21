/**
 * Meteora Bonding Curve Launch Service
 * Integrates with Meteora DBC SDK to launch tokens on bonding curves
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
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
      this.client = new DynamicBondingCurveClient(
        this.connection,
        // @ts-ignore
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
   * Let the SDK handle mint and token creation - much simpler!
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
          uri: metadata.imageUrl || '',
          payer: payer,
          poolCreator: payer,
        },
        firstBuyParam: firstBuyParam,
      });

      console.log('✅ Pool transaction created by SDK');

      // 6. Build final transaction (SDK handles everything)
      const finalTx = new Transaction();

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
    } catch (error) {
      console.error('❌ Error creating pool with SDK:', error);
      throw error;
    }
  }
}