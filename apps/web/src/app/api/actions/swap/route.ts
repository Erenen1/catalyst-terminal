import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from '@solana/actions';
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';

/**
 * GET /api/actions/swap?mint=<token_address>
 * Returns Action metadata for a Jupiter Swap.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get('mint');

  if (!mint) {
    return new Response('Mint parameter is required', {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }

  // Burada Birdeye veya Jupiter'den token ismini/logosunu çekmek şık olur
  // Ama şimdilik generic bir mesaj dönelim
  const payload: ActionGetResponse = {
    icon: `https://img.api.birdeye.so/v1/token/logo/solana/${mint}`, // Birdeye logo proxy
    title: 'Catalyst Terminal — Quick Buy',
    description: `Instantly swap SOL for this token using Jupiter. Alpha identified by Catalyst Terminal.`,
    label: 'Buy with 0.1 SOL',
    links: {
      actions: [
        {
          label: 'Buy 0.1 SOL',
          href: `/api/actions/swap?mint=${mint}&amount=0.1`,
        },
        {
          label: 'Buy 0.5 SOL',
          href: `/api/actions/swap?mint=${mint}&amount=0.5`,
        },
        {
          label: 'Buy 1 SOL',
          href: `/api/actions/swap?mint=${mint}&amount=1`,
        },
      ],
    },
  };

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

// OPTIONS for CORS
export const OPTIONS = GET;

/**
 * POST /api/actions/swap?mint=<token_address>&amount=<sol_amount>
 * Generates a Jupiter Swap transaction.
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mint = searchParams.get('mint');
    const amount = searchParams.get('amount') || '0.1';
    
    const body: ActionPostRequest = await req.json();
    const account = new PublicKey(body.account);

    if (!mint) throw new Error('Mint is required');

    // 1. Get Quote from Jupiter
    // 0.1 SOL = 100,000,000 lamports (approx)
    const lamports = parseFloat(amount) * 1_000_000_000;
    
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mint}&amount=${lamports}&slippageBps=100`
    ).then((res) => res.json());

    if (quoteResponse.error) {
      throw new Error(`Jupiter Quote Error: ${quoteResponse.error}`);
    }

    // 2. Get Swap Transaction from Jupiter
    const { swapTransaction } = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: account.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    }).then((res) => res.json());

    // 3. Return Action Response
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction: swapTransaction,
        message: `Buy ${amount} SOL worth of token — via Catalyst Terminal`,
      },
    });

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (err: any) {
    return new Response(err.message || 'Error creating transaction', {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
}
