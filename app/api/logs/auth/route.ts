import { NextRequest, NextResponse } from 'next/server';

const LOGS_PASSWORD = '26199608';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password === LOGS_PASSWORD) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Password non corretta' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Errore del server' }, { status: 500 });
  }
}
