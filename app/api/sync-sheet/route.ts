import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { webhookUrl, data } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return NextResponse.json(
        { success: false, error: 'URL Webhook Google Apps Script không hợp lệ.' },
        { status: 400 }
      );
    }

    // Forward the session data to Google Apps Script Webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      redirect: 'follow',
    });

    const text = await response.text();
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(text);
    } catch {
      parsedData = { message: text };
    }

    return NextResponse.json({
      success: true,
      result: parsedData,
    });
  } catch (err: any) {
    console.error('Error syncing to Google Sheet:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Không thể kết nối tới Google Apps Script Webhook.',
      },
      { status: 500 }
    );
  }
}
