-- Create table to track device submissions
CREATE TABLE public.device_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT,
  user_id_field TEXT
);

-- Create index for faster lookups
CREATE INDEX idx_device_submissions_device_id ON public.device_submissions(device_id);
CREATE INDEX idx_device_submissions_submitted_at ON public.device_submissions(submitted_at);

-- Enable RLS
ALTER TABLE public.device_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for form submissions)
CREATE POLICY "Allow anonymous inserts" 
ON public.device_submissions 
FOR INSERT 
WITH CHECK (true);

-- Allow anonymous selects (for checking cooldown)
CREATE POLICY "Allow anonymous selects" 
ON public.device_submissions 
FOR SELECT 
USING (true);

-- Create function to clean old records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_submissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.device_submissions 
  WHERE submitted_at < NOW() - INTERVAL '1 hour';
END;
$$;