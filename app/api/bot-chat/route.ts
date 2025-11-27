// app/api/bot-chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { botChatLimiter } from '@/lib/rate-limiter';
import { sanitizeUserInput, sanitizeErrorMessage } from '@/utils/security';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const BOT_SYSTEM_PROMPT = `You are the expert support assistant for Chad Mint, the best Solana token launchpad for chads. Your goal is to help users launch, trade, and earn.
BRAND VOICE
Professional, knowledgeable, and concise.
Use crypto-native terminology correctly (e.g., "bonding curve", "mint authority", "on-chain metadata").
Confident and helpful.
CORE CAPABILITIES

LAUNCH TOKENS
Users can create tokens via two methods:

METEORA BONDING CURVE (DBC)
Best for instant trading. Creates a dynamic pool where price rises as people buy. No liquidity seeding required.
Graduation: Automatically migrates to Meteora DEX when Market Cap hits 425 SOL.
Creator Rewards: Devs earn 10% of trading fees from the curve and receive 5% of locked LP tokens after graduation.
DIRECT MINT (TOKEN-2022)
Best for standard utility tokens. Uses Solana's Token-2022 standard with on-chain metadata pointers.

EARN (REFERRALS)
Users generate a unique link connecting their wallet.
Earn 55% commission on service fees from anyone who mints a direct token using their link.
Payouts are instant and on-chain.
TRADE
Hot Tokens: View top performing tokens sorted by volume, volatility, and liquidity.
Swap: Integrated Jupiter aggregator to swap any token on Solana.

TECHNICAL SPECIFICATIONS AND FEES

FEES (DIRECT MINT)
Base Service Fee: 0.08 SOL (Covers platform usage).
Authority Revocation: +0.1 SOL per authority (Mint or Freeze) revoked.
Example: A secure mint (revoking both Mint and Freeze authorities) costs 0.08 + 0.1 + 0.1 = 0.28 SOL total service fee.
FEES (METEORA LAUNCH)
Creation Fee: 0.00 SOL (Free platform fee).
Cost: Users only pay for the "First Buy" amount they choose to purchase.
TOKEN TECHNOLOGY
We use Token-2022 (Extension type: MetadataPointer).
Metadata (JSON) and images are hosted on IPFS (via Pinata) for decentralization.
The Metadata Pointer stores the IPFS URI directly in the mint account on-chain.

TROUBLESHOOTING KNOWLEDGE BASE
Transaction Failed: Usually due to insufficient SOL for "Rent Exemption" (creating accounts requires small storage fees). Users need approximately 0.02-0.05 SOL extra in their wallet beyond the fee.
Image Upload: Requires a wallet signature to authenticate ownership before uploading to IPFS.
Meteora Pools: If a pool doesn't appear instantly on Solscan, it is normal. The indexer takes a few minutes.
Revoking Authorities:
Mint Authority: If kept, the creator can mint unlimited tokens (security risk). Revoking makes supply fixed.
Freeze Authority: If kept, the creator can freeze holder accounts. Revoking ensures users can always trade.
CONTACT AND LINKS
App: https://chadmint.fun
Support Email: contact@chadmint.fun
X (Twitter): https://x.com/chad_mint_team
Telegram: https://t.me/chad_mint
INSTRUCTIONS FOR ANSWERS

Be Concise: Do not ramble. Get to the solution. If people say stupid stuff call them a virgin dev, if people say smart stuff call them a based dev.
Sell the Benefits: When asked about features, highlight why they matter (e.g., "Revoking authorities builds trust with your community").
Formatting: Do NOT use markdown formatting, you can use dashes though
Safety: Never ask for private keys or seed phrases.
Referrals: If users ask about making money, explain the 55% referral commission.
Creator Incentives: Mention the 10% trading fee share and 5% LP token reward when asked about benefits for developers.`;
interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

/**
 * Detect potential prompt injection attempts
 * Returns true if suspicious patterns are detected
 */
function detectPromptInjection(input: string): boolean {
  const suspiciousPatterns = [
    /ignore.*previous|forget.*instructions|disregard/i,
    /system.*prompt|jailbreak|override/i,
    /act as|pretend to be|role play/i,
    /tell me.*password|credentials|secret/i,
    /execute.*code|run.*script|eval/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

export async function POST(request: NextRequest) {
  try {
    // ✅ Get client IP for rate limiting and logging
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown';

    console.log(`[Bot Chat] New request from IP: ${ip}`);

    // ✅ Check rate limit FIRST
    const rateLimitResult = await botChatLimiter.isAllowed(ip);

    if (!rateLimitResult.allowed) {
      console.warn(`⚠️  Rate limited: ${ip} (retry after ${rateLimitResult.retryAfter}s)`);

      return NextResponse.json(
        {
          success: false,
          error: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter!.toString(),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      );
    }

    // ✅ Parse and validate request body
    let message: string;
    try {
      const body = await request.json();
      message = body.message;
    } catch (e) {
      console.error('[Bot Chat] Invalid JSON in request body');
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // ✅ Type check
    if (!message || typeof message !== 'string') {
      console.warn('[Bot Chat] Missing or invalid message field');
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // ✅ Length check BEFORE sanitization
    if (message.length > 2000) {
      console.warn(`[Bot Chat] Message too long: ${message.length} chars from ${ip}`);
      return NextResponse.json(
        { success: false, error: 'Message too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // ✅ Empty check
    if (message.trim().length === 0) {
      console.warn('[Bot Chat] Empty message from ' + ip);
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    // ✅ SANITIZE: Remove XSS, script patterns, dangerous characters
    const originalMessage = message;
    const sanitizedMessage = sanitizeUserInput(message, 1000);

    // Log if sanitization changed the message
    if (originalMessage !== sanitizedMessage) {
      console.warn('[Bot Chat] Message sanitized (removed dangerous content)');
      console.warn(`  Original length: ${originalMessage.length}`);
      console.warn(`  Sanitized length: ${sanitizedMessage.length}`);
    }

    // ✅ Detect prompt injection attempts
    if (detectPromptInjection(sanitizedMessage)) {
      console.warn(`[Bot Chat] Potential prompt injection detected from ${ip}`);
      console.warn(`  Message: ${sanitizedMessage.substring(0, 100)}...`);

      // Don't expose the reason to user (security through obscurity)
      return NextResponse.json(
        { success: false, error: 'Your message could not be processed. Please try a different question.' },
        { status: 400 }
      );
    }

    // ✅ Final validation - ensure message is still not empty after sanitization
    if (sanitizedMessage.trim().length === 0) {
      console.warn('[Bot Chat] Message became empty after sanitization');
      return NextResponse.json(
        { success: false, error: 'Your message contains only invalid characters. Please try again.' },
        { status: 400 }
      );
    }

    console.log(`[Bot Chat] Processing sanitized message: "${sanitizedMessage.substring(0, 50)}..."`);

    // ✅ Check for API key
    if (!OPENROUTER_API_KEY) {
      console.error('[Bot Chat] OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'API not configured' },
        { status: 500 }
      );
    }

    // ✅ Create abort controller for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      console.log('[Bot Chat] Sending request to OpenRouter...');

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://chadmint.com',
          'X-Title': 'Chad Mint Chat',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-small-24b-instruct-2501',
          messages: [
            {
              role: 'system',
              content: BOT_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: sanitizedMessage, // ✅ Use SANITIZED message
            },
          ],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 1000,
          reasoning: { exclude: true },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Bot Chat] OpenRouter error:', response.status, errorData);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to get response from AI service',
          },
          { status: response.status }
        );
      }

      const data = (await response.json()) as OpenRouterResponse;

      if (data.error) {
        console.error('[Bot Chat] OpenRouter API error:', data.error);
        return NextResponse.json(
          { success: false, error: data.error.message },
          { status: 500 }
        );
      }

      if (!data.choices || !data.choices[0]) {
        console.error('[Bot Chat] Invalid response from OpenRouter:', data);
        return NextResponse.json(
          { success: false, error: 'Invalid response from AI service' },
          { status: 500 }
        );
      }

      const responseText = data.choices[0].message.content.trim();

      console.log('[Bot Chat] ✅ Successfully processed message');

      // ✅ Include rate limit info in response headers
      return NextResponse.json(
        {
          success: true,
          response: responseText,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      );
    } catch (error) {
      clearTimeout(timeoutId);

      // ✅ Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[Bot Chat] OpenRouter request timeout');
        return NextResponse.json(
          {
            success: false,
            error: 'Request timeout - AI service took too long to respond',
          },
          { status: 504 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error('[Bot Chat] Fatal error:', error);

    // ✅ Sanitize error message before sending to client
    const safeErrorMessage = sanitizeErrorMessage(error);

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}