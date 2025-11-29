import type { VercelRequest, VercelResponse } from '@vercel/node';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TelegramRequest {
  subjectName: string;
  name: string;
  id: string;
  weekNumber: string;
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

    console.log('Environment check:', {
      hasBotToken: !!TELEGRAM_BOT_TOKEN,
      hasChatId: !!TELEGRAM_CHAT_ID,
      botTokenLength: TELEGRAM_BOT_TOKEN?.length || 0,
      chatIdLength: TELEGRAM_CHAT_ID?.length || 0,
    });

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Missing Telegram configuration - BOT_TOKEN:', !!TELEGRAM_BOT_TOKEN, 'CHAT_ID:', !!TELEGRAM_CHAT_ID);
      return res.status(500).json({ 
        success: false, 
        error: 'Telegram configuration is missing. Please add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to Vercel environment variables.' 
      });
    }

    const { subjectName, name, id, weekNumber }: TelegramRequest = req.body;

    // Validate input
    if (!subjectName || !name || !id || !weekNumber) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    // Sanitize input
    const sanitizedSubject = subjectName.trim().substring(0, 100);
    const sanitizedName = name.trim().substring(0, 100);
    const sanitizedId = id.trim().substring(0, 50);
    const sanitizedWeek = weekNumber.trim().substring(0, 20);

    // Format message for Telegram
    const message = `🔐 *تسجيل حضور جديد*\n\n` +
      `📚 *المادة:* ${sanitizedSubject}\n` +
      `👤 *الاسم:* ${sanitizedName}\n` +
      `🆔 *رقم الهوية:* ${sanitizedId}\n` +
      `📅 *الأسبوع:* ${sanitizedWeek}\n` +
      `🕐 *التوقيت:* ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}\n` +
      `━━━━━━━━━━━━━━━━`;

    console.log('Sending message to Telegram:', { subject: sanitizedSubject, name: sanitizedName, id: sanitizedId, week: sanitizedWeek });

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
      console.error('Telegram API error:', telegramResult);
      return res.status(500).json({ 
        success: false, 
        error: `Telegram API error: ${telegramResult.description || 'Unknown error'}` 
      });
    }

    return res.status(200).json({ success: true, message: 'Data sent successfully' });
  } catch (error: unknown) {
    console.error('Error in send-to-telegram function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
