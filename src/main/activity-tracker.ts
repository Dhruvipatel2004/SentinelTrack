import { uIOhook } from 'uiohook-napi';
import { EventEmitter } from 'events';
import { initStore } from './store';
import { randomUUID } from 'crypto';

export class ActivityTracker extends EventEmitter {
    private isTracking: boolean = false;
    private isPaused: boolean = false;
    private keystrokeCount: number = 0;
    private clickCount: number = 0;
    private lastActivityTime: number = Date.now();
    private idleThresholdMs: number = 5 * 60 * 1000; // 5 minutes
    private isIdle: boolean = false;
    private flushInterval: NodeJS.Timeout | null = null;
    private sessionId: string = randomUUID();
    private userId: string | null = null;
    private sessionStartTime: number | null = null;
    private elapsedSeconds: number = 0;
    private lastFlushElapsedSeconds: number = 0;
    private timerInterval: NodeJS.Timeout | null = null;
    private currentMetadata: {
        projectId?: string;
        milestoneId?: string;
        taskId?: string;
        workDescription?: string;
    } = {};

    private lastScreenshotTime: number = Date.now();
    private screenshotIntervalMs: number = 5 * 60 * 1000; // 5 minute

    constructor() {
        super();
        this.setupListeners();
    }

    public setUserId(id: string) { 
        this.userId = id;
    }

    private setupListeners() {
        uIOhook.on('keydown', () => {
            if (!this.isTracking || this.isPaused) return;
            this.keystrokeCount++;
            this.updateActivity();
        });

        uIOhook.on('mousedown', () => {
            if (!this.isTracking || this.isPaused) return;
            this.clickCount++;
            this.updateActivity();
        });
    }

    private updateActivity() {
        this.lastActivityTime = Date.now();
        if (this.isIdle) {
            this.isIdle = false;
            this.emit('idle-status-changed', false);
        }
    }

    public startTracking(metadata: { projectId?: string, milestoneId?: string, taskId?: string, workDescription?: string } = {}) {
        if (this.isTracking) {
            if (this.isPaused) {
                this.resumeTracking();
            }
            return;
        }
        if (!this.userId) return;

        this.isTracking = true;
        this.isPaused = false;
        this.sessionStartTime = Date.now();
        this.lastScreenshotTime = Date.now(); // Reset screenshot timer on start
        this.sessionId = randomUUID();
        this.elapsedSeconds = 0;
        this.currentMetadata = metadata;

        // Reset counters at the START of a new session
        this.keystrokeCount = 0;
        this.clickCount = 0;
        this.lastFlushElapsedSeconds = 0;

        this.startTimer();

        try {
            uIOhook.start();
        } catch (e) {
            console.error('Failed to start uIOhook:', e);
        }
        this.startIdleCheck();
        // Removed periodic flush loop - we want one log per session now
    }

    private startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.elapsedSeconds++;

                // Screenshot Trigger Check
                const now = Date.now();
                if (now - this.lastScreenshotTime >= this.screenshotIntervalMs) {
                    this.lastScreenshotTime = now;
                    this.emit('trigger-screenshot', { ...this.currentMetadata, sessionId: this.sessionId });
                }
            }
        }, 1000);
    }

    public pauseTracking() {
        if (!this.isTracking || this.isPaused) return;
        this.isPaused = true;
        this.emit('pause-status-changed', true);
    }

    public resumeTracking() {
        if (!this.isTracking || !this.isPaused) return;
        this.isPaused = false;
        this.emit('pause-status-changed', false);
    }

    public async stopTracking() {
        if (!this.isTracking) return;

        try {
            // Capture the final stats for the single session log
            await this.flushToStore();
        } catch (error) {
            console.error('Error flushing to store during stop:', error);
        } finally {
            this.isTracking = false;
            this.isPaused = false;

            try {
                uIOhook.stop();
            } catch (e) {
                console.warn('Error stopping uIOhook:', e);
            }

            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            if (this.flushInterval) {
                clearInterval(this.flushInterval);
                this.flushInterval = null;
            }

            // Reset values after stopping so they don't persist to the next session
            this.resetTracking();
        }
    }

    public resetTracking() {
        this.elapsedSeconds = 0;
        this.lastFlushElapsedSeconds = 0;
        this.keystrokeCount = 0;
        this.clickCount = 0;
    }

    public getStats() {
        return {
            keystrokes: this.keystrokeCount,
            clicks: this.clickCount,
            isIdle: this.isIdle,
            isTracking: this.isTracking,
            isPaused: this.isPaused,
            elapsedSeconds: this.elapsedSeconds,
        };
    }

    private startIdleCheck() {
        setInterval(() => {
            if (!this.isTracking || this.isPaused) return;
            const timeSinceLastActivity = Date.now() - this.lastActivityTime;
            if (timeSinceLastActivity > this.idleThresholdMs && !this.isIdle) {
                this.isIdle = true;
                this.emit('idle-status-changed', true);
                console.log('System is idle');
            }
        }, 10000); // Check every 10 seconds
    }

    private startFlushLoop() {
        // Disabled: No longer flushing periodically
    }

    private async flushToStore() {
        if (!this.userId) {
            console.warn('No user ID set, skipping log flush');
            return;
        }

        // For a single session log, duration is the total elapsed time
        const duration = this.elapsedSeconds;

        // Don't log if there was zero activity and zero time (unless it's just a quick stop)
        if (this.keystrokeCount === 0 && this.clickCount === 0 && duration === 0) {
            console.log('Skipping flush: No activity recorded.');
            return;
        }

        const log = {
            id: randomUUID(),
            userId: this.userId,
            sessionId: this.sessionId,
            keystrokeCount: this.keystrokeCount,
            clickCount: this.clickCount,
            durationSeconds: duration,
            timestamp: new Date().toISOString(),
            projectId: this.currentMetadata.projectId,
            milestoneId: this.currentMetadata.milestoneId,
            taskId: this.currentMetadata.taskId,
            workDescription: this.currentMetadata.workDescription
        };

        const store = await initStore();
        await store.read();
        console.log('Saving session log to store:', log);
        store.data.pendingLogs.push(log);
        await store.write();
    }
}

export const activityTracker = new ActivityTracker();
