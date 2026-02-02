-- Create a table for Activity Logs
CREATE TABLE public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    keystroke_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    log_timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create Policy: Users can only see their own logs
CREATE POLICY "Users can view their own activity logs" 
ON public.activity_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Create Policy: Users can only insert their own logs
CREATE POLICY "Users can insert their own activity logs" 
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create Policy: Users can update their own logs (Optional, if needed for corrections)
CREATE POLICY "Users can update their own activity logs" 
ON public.activity_logs
FOR UPDATE
USING (auth.uid() = user_id);
