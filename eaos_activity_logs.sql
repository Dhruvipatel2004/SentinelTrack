-- SQL for EAOS Supabase Project
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL, -- This should be the clerk_user_id
    project_id UUID REFERENCES public.sows(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES public.sow_milestones(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.milestone_tasks(id) ON DELETE SET NULL,
    work_description TEXT,
    keystroke_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    log_timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies for developer access
CREATE POLICY "Developers can insert their own logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid()::text = user_id OR user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Developers can view their own logs"
ON public.activity_logs
FOR SELECT
USING (auth.uid()::text = user_id OR user_id = auth.jwt() ->> 'sub');

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON public.activity_logs(project_id);
