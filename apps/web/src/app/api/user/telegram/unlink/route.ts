import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { UserModel } from '@chaintrigger/shared';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    await dbConnect();

    await UserModel.findOneAndUpdate(
      { walletAddress: address.toLowerCase() },
      { 
        $unset: { 
          telegramChatId: "", 
          telegramUsername: "", 
          telegramVerificationToken: "" 
        } 
      },
      { new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking telegram:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
