import { JSONFilePreset } from 'lowdb/node'

// Define the schema for the local database
export interface LocalData {
    pendingLogs: ActivityLog[];
    sessionToken: string | null;
}

export interface ActivityLog {
    id: string; // UUID
    userId: string;
    sessionId: string;
    keystrokeCount: number;
    clickCount: number;
    durationSeconds: number;
    timestamp: string;
    projectId?: string;
    milestoneId?: string;
    taskId?: string;
    workDescription?: string;
}

const defaultData: LocalData = { pendingLogs: [], sessionToken: null }

// Initialize the database
export const initStore = async () => {
    const db = await JSONFilePreset<LocalData>('db.json', defaultData)
    return db
}
