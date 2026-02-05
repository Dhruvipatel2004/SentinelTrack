import { supabase, supabaseUrl, supabaseKey } from './supabase'
import { createClient } from '@supabase/supabase-js'
import { initStore, ActivityLog } from './store'
import { app } from 'electron'
import { randomUUID } from 'crypto'

export class SyncService {
    private isSyncing: boolean = false;
    private syncInterval: NodeJS.Timeout | null = null;
    private currentAccessToken: string | null = null;

    constructor() {
        console.log('[SyncService] Initializing SyncService...');
        this.startSyncLoop();
    }

    private startSyncLoop() {
        console.log('[SyncService] Starting sync loop (30s interval)...');
        // Try to sync every 30 seconds
        this.syncInterval = setInterval(() => {
            this.syncPendingLogs();
        }, 30 * 1000);
    }

    public async addManualLog(log: Omit<ActivityLog, 'id' | 'sessionId' | 'keystrokeCount' | 'clickCount'>) {
        try {
            console.log(`[SyncService] Adding manual log for task: ${log.taskId}`);

            // 1. Insert into activity_logs
            const { error: activityError } = await supabase
                .from('activity_logs')
                .insert({
                    user_id: log.userId,
                    session_id: randomUUID(), // Generate a valid UUID for manual entry
                    keystroke_count: 0,
                    click_count: 0,
                    duration_seconds: log.durationSeconds,
                    log_timestamp: log.timestamp,
                    project_id: log.projectId,
                    milestone_id: log.milestoneId,
                    task_id: log.taskId,
                    work_description: log.workDescription
                });

            if (activityError) {
                console.error('[SyncService] Manual activity_logs Insert Error:', activityError.message);
                throw activityError;
            }

            // 2. Insert into work_updates
            if (log.taskId) {
                const { error: workError } = await supabase
                    .from('work_updates')
                    .insert({
                        developer_id: log.userId,
                        project_id: log.projectId,
                        milestone_id: log.milestoneId,
                        task_id: log.taskId,
                        work_description: log.workDescription || 'Manual Entry',
                        duration_minutes: Math.max(1, Math.round(log.durationSeconds / 60)),
                        work_date: new Date(log.timestamp).toISOString().split('T')[0]
                    });

                if (workError) {
                    console.error('[SyncService] Manual work_updates Insert Error:', workError.message);
                }
            }

            return true;
        } catch (err) {
            console.error('[SyncService] addManualLog failed:', err);
            return false;
        }
    }

    public async syncPendingLogs() {

        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const store = await initStore();
            await store.read();

            const pendingLogs = store.data.pendingLogs;

            if (pendingLogs.length === 0) {
                this.isSyncing = false;
                return;
            }

            console.log(`[SyncService] Syncing ${pendingLogs.length} logs to Supabase.`);

            // 1. Sync to Detailed activity_logs
            const { error: activityError } = await supabase
                .from('activity_logs')
                .insert(pendingLogs.map(log => ({
                    user_id: log.userId,
                    session_id: log.sessionId,
                    keystroke_count: log.keystrokeCount,
                    click_count: log.clickCount,
                    duration_seconds: log.durationSeconds,
                    log_timestamp: log.timestamp,
                    project_id: log.projectId,
                    milestone_id: log.milestoneId,
                    task_id: log.taskId,
                    work_description: log.workDescription
                })));

            if (activityError) {
                console.error('[SyncService] activity_logs Insert Error:', activityError.message);
                // We'll continue to work_updates even if this fails, or decide to retry
            }

            // 2. Sync to EAOS work_updates
            const workUpdates = pendingLogs
                .filter(log => log.taskId) // Only sync if a task was selected
                .map(log => ({
                    developer_id: log.userId,
                    project_id: log.projectId,
                    milestone_id: log.milestoneId,
                    task_id: log.taskId,
                    work_description: log.workDescription || 'Desktop Tracked Activity',
                    duration_minutes: Math.max(1, Math.round(log.durationSeconds / 60)), // Minimum 1 minute
                    work_date: new Date(log.timestamp).toISOString().split('T')[0]
                }));

            if (workUpdates.length > 0) {
                const { error: workError } = await supabase
                    .from('work_updates')
                    .insert(workUpdates);

                if (workError) {
                    console.error('[SyncService] work_updates Insert Error:', workError.message);
                }
            }

            if (!activityError) {
                store.data.pendingLogs = [];
                await store.write();
                console.log(`[SyncService] Successfully synced logs.`);
            }

        } catch (err) {
            console.error('[SyncService] Sync failed:', err);
        } finally {
            this.isSyncing = false;
        }
    }

    public async getHistory(userId: string) {
        try {
            console.log(`[SyncService] Fetching history (activity_logs) for user: ${userId}`);

            // 1. Fetch raw logs
            const { data: logs, error } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('user_id', userId)
                .order('log_timestamp', { ascending: false })
                .limit(50);

            if (error) throw error;
            if (!logs || logs.length === 0) return [];

            // 2. Extract IDs for manual join
            const projectIds = [...new Set(logs.map(l => l.project_id).filter(Boolean))];
            const milestoneIds = [...new Set(logs.map(l => l.milestone_id).filter(Boolean))];
            const taskIds = [...new Set(logs.map(l => l.task_id).filter(Boolean))];

            // 3. Fetch related data in parallel using CORRECT table names
            const [projectsRes, milestonesRes, tasksRes] = await Promise.all([
                projectIds.length > 0 ? supabase.from('sows').select('id, title').in('id', projectIds) : { data: [] },
                milestoneIds.length > 0 ? supabase.from('sow_milestones').select('id, title').in('id', milestoneIds) : { data: [] },
                taskIds.length > 0 ? supabase.from('milestone_tasks').select('id, title').in('id', taskIds) : { data: [] }
            ]);

            // 4. Create lookup maps
            const projectMap = new Map((projectsRes.data || []).map(p => [p.id, p]));
            const milestoneMap = new Map((milestonesRes.data || []).map(m => [m.id, m]));
            const taskMap = new Map((tasksRes.data || []).map(t => [t.id, t]));

            // 5. Attach data to logs
            const enrichedLogs = logs.map(log => ({
                ...log,
                project: log.project_id ? projectMap.get(log.project_id) : null,
                milestone: log.milestone_id ? milestoneMap.get(log.milestone_id) : null,
                task: log.task_id ? taskMap.get(log.task_id) : null
            }));

            if (enrichedLogs.length > 0) {
                console.log(`[SyncService] History fetched & enriched. Count: ${enrichedLogs.length}`);
            }

            return enrichedLogs;
        } catch (err) {
            console.error('[SyncService] History fetch failed:', err);
            return [];
        }
    }

    public async setSession(accessToken: string) {
        try {
            console.log('[SyncService] Updating Supabase session...');
            this.currentAccessToken = accessToken;
            const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: ''
            });
            if (error) throw error;
            console.log('[SyncService] Supabase session updated successfully. User:', data.session?.user?.id);
        } catch (error) {
            console.error('[SyncService] Failed to set Supabase session:', error);
            throw error;
        }
    }

    /**
     * Registers a user in the EAOS database (public.users table).
     * This uses the main process's supabase client (privileged).
     */
    public async registerUser(userData: { id: string; email: string; fullName: string }, token?: string | null) {
        try {
            console.log(`[SyncService] Registering/Updating user: ${userData.email} (${userData.id})`);
            if (token) this.currentAccessToken = token;
            // Token is set in main via setClerkToken(); do not use auth.setSession (rejects Clerk JWT).
            console.log(`[SyncService] Target Clerk ID: ${userData.id}`);

            // Check if user exists or upsert them
            // In public.users table (EAOS), clerk_user_id is the unique link
            console.log('[SyncService] Attempting upsert with clerk_user_id:', userData.id);
            const { data, error } = await supabase
                .from('users')
                .upsert({
                    clerk_user_id: userData.id,
                    email: userData.email,
                    full_name: userData.fullName
                }, {
                    onConflict: 'clerk_user_id'
                })
                .select('id')
                .single();

            if (error) {
                console.error('[SyncService] Error upserting user:', error.message);
                throw error;
            }

            if (data?.id) {
                console.log(`[SyncService] User registered/resolved. DB UUID: ${data.id}`);
                return data.id;
            }

            // Fallback: try to fetch manually if single() failed to return data
            const { data: fetchRes, error: fetchErr } = await supabase
                .from('users')
                .select('id')
                .eq('clerk_user_id', userData.id)
                .single();

            if (fetchErr || !fetchRes) {
                console.error('[SyncService] Failed to retrieve user ID after upsert:', fetchErr?.message);
                return null;
            }

            console.log(`[SyncService] User resolved via fallback fetch. DB UUID: ${fetchRes.id}`);
            return fetchRes.id;

        } catch (error) {
            console.error('[SyncService] registerUser failed:', error);
            return null;
        }
    }

    public stop() {
        console.log('[SyncService] Stopping sync loop...');
        if (this.syncInterval) clearInterval(this.syncInterval);
    }
}

export const syncService = new SyncService();