import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const COOLDOWN_MINUTES = 30;

interface CheckRequest {
  device_id: string;
  action: 'check' | 'submit';
  name?: string;
  user_id_field?: string;
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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration - URL:', !!supabaseUrl, 'KEY:', !!supabaseKey);
      return res.status(500).json({ 
        success: false, 
        error: 'Supabase configuration is missing. Add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel.' 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { device_id, action, name, user_id_field }: CheckRequest = req.body;

    console.log('[Device Cooldown] Request:', { device_id, action });

    if (!device_id) {
      return res.status(400).json({ success: false, error: 'Device ID is required' });
    }

    // Calculate cooldown threshold (30 minutes ago)
    const cooldownThreshold = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();

    if (action === 'check') {
      // Check if device has submitted within cooldown period
      const { data: submissions, error } = await supabase
        .from('device_submissions')
        .select('submitted_at')
        .eq('device_id', device_id)
        .gte('submitted_at', cooldownThreshold)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[Device Cooldown] Check error:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      if (submissions && submissions.length > 0) {
        const lastSubmission = new Date(submissions[0].submitted_at);
        const remaining = (lastSubmission.getTime() + COOLDOWN_MINUTES * 60 * 1000) - Date.now();
        
        console.log('[Device Cooldown] Device in cooldown, remaining:', remaining);
        
        return res.status(200).json({ 
          inCooldown: true, 
          remaining,
          lastSubmission: submissions[0].submitted_at
        });
      }

      console.log('[Device Cooldown] Device NOT in cooldown');
      return res.status(200).json({ inCooldown: false, remaining: 0 });
    }

    if (action === 'submit') {
      // First check if already in cooldown
      const { data: existingSubmissions, error: checkError } = await supabase
        .from('device_submissions')
        .select('submitted_at')
        .eq('device_id', device_id)
        .gte('submitted_at', cooldownThreshold)
        .limit(1);

      if (checkError) {
        console.error('[Device Cooldown] Pre-submit check error:', checkError);
        return res.status(500).json({ success: false, error: checkError.message });
      }

      if (existingSubmissions && existingSubmissions.length > 0) {
        const lastSubmission = new Date(existingSubmissions[0].submitted_at);
        const remaining = (lastSubmission.getTime() + COOLDOWN_MINUTES * 60 * 1000) - Date.now();
        
        console.log('[Device Cooldown] Submit blocked - device in cooldown');
        
        return res.status(403).json({ 
          success: false, 
          inCooldown: true, 
          remaining,
          message: 'Device is in cooldown period'
        });
      }

      // Record the new submission
      const { error: insertError } = await supabase
        .from('device_submissions')
        .insert({
          device_id,
          name: name || null,
          user_id_field: user_id_field || null,
        });

      if (insertError) {
        console.error('[Device Cooldown] Insert error:', insertError);
        return res.status(500).json({ success: false, error: insertError.message });
      }

      console.log('[Device Cooldown] Submission recorded successfully');

      return res.status(200).json({ 
        success: true, 
        message: 'Submission recorded',
        cooldownUntil: new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000).toISOString()
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });

  } catch (error: unknown) {
    console.error('[Device Cooldown] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
