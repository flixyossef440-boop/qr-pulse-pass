import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLDOWN_MINUTES = 30;

interface CheckRequest {
  device_id: string;
  action: 'check' | 'submit';
  name?: string;
  user_id_field?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { device_id, action, name, user_id_field }: CheckRequest = await req.json();

    console.log('[Device Cooldown] Request:', { device_id, action });

    if (!device_id) {
      throw new Error('Device ID is required');
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
        throw error;
      }

      if (submissions && submissions.length > 0) {
        const lastSubmission = new Date(submissions[0].submitted_at);
        const remaining = (lastSubmission.getTime() + COOLDOWN_MINUTES * 60 * 1000) - Date.now();
        
        console.log('[Device Cooldown] Device in cooldown, remaining:', remaining);
        
        return new Response(
          JSON.stringify({ 
            inCooldown: true, 
            remaining,
            lastSubmission: submissions[0].submitted_at
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('[Device Cooldown] Device NOT in cooldown');
      return new Response(
        JSON.stringify({ inCooldown: false, remaining: 0 }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
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
        throw checkError;
      }

      if (existingSubmissions && existingSubmissions.length > 0) {
        const lastSubmission = new Date(existingSubmissions[0].submitted_at);
        const remaining = (lastSubmission.getTime() + COOLDOWN_MINUTES * 60 * 1000) - Date.now();
        
        console.log('[Device Cooldown] Submit blocked - device in cooldown');
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            inCooldown: true, 
            remaining,
            message: 'Device is in cooldown period'
          }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
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
        throw insertError;
      }

      console.log('[Device Cooldown] Submission recorded successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Submission recorded',
          cooldownUntil: new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000).toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    throw new Error('Invalid action');

  } catch (error: unknown) {
    console.error('[Device Cooldown] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
