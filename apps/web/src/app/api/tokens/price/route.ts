export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const chain = searchParams.get('chain') || 'solana';

  if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

  try {
    const res = await fetch(`https://public-api.birdeye.so/defi/price?address=${address}`, {
      headers: {
        'X-API-KEY': process.env.BIRDEYE_API_KEY || '',
        'x-chain': chain
      }
    });
    const data = await res.json();
    return NextResponse.json(data.data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}
