// app/api/bot-chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { botChatLimiter } from '@/lib/rate-limiter';
import { sanitizeUserInput, sanitizeErrorMessage } from '@/utils/security';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const BOT_SYSTEM_PROMPT = `You are an expert assistant for Chad Mint, a professional Solana token minting platform. Keep responses concise and helpful.

KEY FEATURES:
- Meteora Dynamic Bonding Curve launches, with no fees
- Token 2022 with on-chain metadata
- Token trading, trade hot tokens across meteora bonding pool and trade new tokens launched on Chad Mint
- Authority management (mint & freeze)
- Service fees for direct mint: 0.08 SOL base + 0.1 SOL per authority revoke
- Referral program: Earn 55% commissions

REFERRAL PROGRAM:
- Create your unique referral link
- Earn 55% on every token created
- Instant on-chain payments

CONTACT:
- Website: https://chadmint.com
- Email: contact@chadmint.fun
- Twitter: https://x.com/chad_mint_team
- Telegram: https://t.me/chad_mint

When answering:
1. Be helpful and accurate about Chad Mint
2. Highlight security benefits
3. Encourage referral program participation
4. Guide users to https://chadmint.com
5. No markdown formatting in responses
6. Keep answers concise`;

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