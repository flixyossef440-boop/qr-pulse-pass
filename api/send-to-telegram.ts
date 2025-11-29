import type { VercelRequest, VercelResponse } from '@vercel/node';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TelegramRequest {
  name: string;
  id: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Missing Telegram configuration');
      throw new Error('Telegram configuration is missing');
    }

    const { name, id }: TelegramRequest = req.body;

    // Validate input
    if (!name || !id) {
      throw new Error('Name and ID are required');
    }

    // Sanitize input
    const sanitizedName = name.trim().substring(0, 100);
    const sanitizedId = id.trim().substring(0, 50);

    // Format message for Telegram
    const message = `🔐 *تسجيل دخول جديد*\n\n` +
      `👤 *الاسم:* ${sanitizedName}\n` +
      `🆔 *ID:* ${sanitizedId}\n` +
      `📅 *التوقيت:* ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}\n` +
      `━━━━━━━━━━━━━━━━`;

    console.log('Sending message to Telegram:', { name: sanitizedName, id: sanitizedId });

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const telegramResult = await telegramResponse.json();
    console.log('Telegram API response:', telegramResult);

    if (!telegramResult.ok) {
      throw new Error(`Telegram API error: ${telegramResult.description}`);
    }

    return res.status(200).json({ success: true, message: 'Data sent successfully' });
  } catch (error: unknown) {
    console.error('Error in send-to-telegram function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
