export const dynamic = 'force-dynamic';
/**
 * @file apps/web/src/app/api/subscriptions/checkout/route.ts
 * @description Sphere Pay abonelik ödeme linki oluşturur.
 *
 * POST /api/subscriptions/checkout
 * Body: { walletAddress: string }
 *
 * Döner: { checkoutUrl: string }
 */

import { NextResponse } from 'next/server';
import { createSphereSubscriptionLink } from '@/lib/sphere';
import dbConnect from '@/lib/db';
import { UserModel } from '@chaintrigger/shared';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { walletAddress } = body as { walletAddress?: string };

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'walletAddress gereklidir.' },
        { status: 400 }
      );
    }

    const normalizedWallet = walletAddress.toLowerCase().trim();

    // Kullanıcıyı bul veya oluştur
    await dbConnect();
    const user = await UserModel.findOneAndUpdate(
      { walletAddress: normalizedWallet },
      { $setOnInsert: { walletAddress: normalizedWallet, tier: 'free', activeRuleCount: 0 } },
      { upsert: true, new: true }
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${appUrl}/upgrade?status=success`;
    const cancelUrl  = `${appUrl}/upgrade?status=canceled`;

    const { url } = await createSphereSubscriptionLink(
      normalizedWallet,
      user._id.toString(),
      successUrl,
      cancelUrl
    );

    return NextResponse.json({ checkoutUrl: url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    console.error('[Subscriptions/Checkout] Hata:', message);
    return NextResponse.json(
      { error: 'Ödeme linki oluşturulamadı.', detail: message },
      { status: 500 }
    );
  }
}
