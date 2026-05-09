export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { RuleModel } from '@chaintrigger/shared';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const body = await request.json();
    const { isActive } = body;

    const updatedRule = await RuleModel.findByIdAndUpdate(
      params.id,
      { isActive },
      { new: true }
    );

    if (!updatedRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(updatedRule);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const deletedRule = await RuleModel.findByIdAndDelete(params.id);

    if (!deletedRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Rule deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
