export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { TrackedTokenModel } from '@chaintrigger/shared';
import dbConnect from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

  try {
    await dbConnect();
    const tracked = await TrackedTokenModel.find({ userId }).sort({ createdAt: -1 });
    
    // Self-Healing Logic: Repair legacy entries missing logos (Optimized Batch)
    const missingLogos = tracked.filter(t => !t.logoURI);
    if (missingLogos.length > 0) {
      const addresses = missingLogos.map(t => t.tokenAddress);
      try {
        const res = await fetch(`https://public-api.birdeye.so/defi/v3/token/meta-data/multiple?addresses=${addresses.join(',')}`, {
          headers: {
            'X-API-KEY': process.env.BIRDEYE_API_KEY || '',
            'x-chain': missingLogos[0].chain
          }
        });
        const data = await res.json();
        const metaMap = data.data || {};

        for (const token of missingLogos) {
          const logo = metaMap[token.tokenAddress]?.logo_uri || metaMap[token.tokenAddress]?.logoURI;
          if (logo) {
            token.logoURI = logo;
            await TrackedTokenModel.updateOne({ _id: token._id }, { logoURI: logo });
          }
        }
      } catch (e) {
        console.error(`Batch repair failed for ${addresses.length} tokens`, e);
      }
    }

    return NextResponse.json(tracked);
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    
    const newTracked = await TrackedTokenModel.create(body);
    return NextResponse.json(newTracked, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Already tracking this token' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  
  try {
    await dbConnect();
    await TrackedTokenModel.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
