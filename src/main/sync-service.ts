import { supabase } from './supabase'
import { initStore, ActivityLog } from './store'
import { app } from 'electron'
import { randomUUID } from 'crypto'

export class SyncService {
    private isSyncing: boolean = false;
    private syncInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.startSyncLoop();
    }

    private startSyncLoop() {
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
        await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: '' // Not strictly needed for the insert if access token is fresh
        });
        console.log('Main process Supabase session updated');
    }

    public stop() {
        if (this.syncInterval) clearInterval(this.syncInterval);
    }
}

export const syncService = new SyncService();
