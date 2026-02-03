import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
// @ts-ignore
import { Activity, MousePointer, Keyboard, Power, Pause, Play, RotateCcw, ChevronDown, ChevronUp, History, Briefcase, Target, ListTodo, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'

const getEaosUserId = async (clerkUserId: string) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('clerk_user_id', clerkUserId)
        .single()

    if (error) {
        console.error('EAOS user mapping failed:', error)
        return null
    }

    return data.id
}

export default function Dashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
    const { getToken } = useAuth()
    const [stats, setStats] = useState({ keystrokes: 0, clicks: 0, isIdle: false, isTracking: false, isPaused: false, elapsedSeconds: 0 })
    const [history, setHistory] = useState<any[]>([])
    const [showHistory, setShowHistory] = useState(false)

    const [allTasks, setAllTasks] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [milestones, setMilestones] = useState<any[]>([])
    const [tasks, setTasks] = useState<any[]>([])

    const [selectedProject, setSelectedProject] = useState('')
    const [selectedMilestone, setSelectedMilestone] = useState('')
    const [selectedTask, setSelectedTask] = useState('')
    const [workDescription, setWorkDescription] = useState('')

    const [isManualEntry, setIsManualEntry] = useState(false)
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
    const [manualStartTime, setManualStartTime] = useState('')
    const [manualEndTime, setManualEndTime] = useState('')
    const [isSavingManual, setIsSavingManual] = useState(false)
    const [dbUserId, setDbUserId] = useState<string | null>(null)

    useEffect(() => {
        const interval = setInterval(async () => {
            const electron = (window as any).electron
            if (electron?.ipcRenderer) {
                const currentStats = await electron.ipcRenderer.invoke('get-activity-stats')
                setStats(currentStats)
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const fetchData = useCallback(async () => {
        console.log('Fetching tasks for user:', user.id)

        const eaosUserId = await getEaosUserId(user.id)
        if (!eaosUserId) {
            console.warn('Could not map Clerk ID to EAOS User ID. Using Clerk ID as fallback.');
        }
        if (eaosUserId) setDbUserId(eaosUserId);

        const fetchId = eaosUserId || user.id;

        const { data, error } = await supabase
            .from('milestone_tasks')
            .select(`
                    id, 
                    title,
                    sow_milestone_id,
                    sow_milestones (
                        id,
                        title,
                        sows (
                            id,
                            title
                        )
                    )
                `)
            .eq('assigned_to', fetchId)
            .eq('is_completed', false)

        if (error) {
            console.error('Error fetching tasks details:', error)
            return
        }

        console.log('Raw tasks data from Supabase:', data)

        if (data) {
            setAllTasks(data)

            const uniqueProjects = Array.from(new Set(data.map(t => {
                const project = (t.sow_milestones as any)?.sows
                return project ? JSON.stringify(project) : null
            }).filter(Boolean))).map(p => JSON.parse(p as string))

            setProjects(uniqueProjects)
            console.log('Projects loaded:', uniqueProjects.length)
        }
    }, [user.id])

    const fetchHistory = useCallback(async () => {
        const electron = (window as any).electron
        if (!electron?.ipcRenderer) return

        try {
            const data = await electron.ipcRenderer.invoke('get-history', user.id)
            setHistory(data || [])
        } catch (err) {
            console.error('Failed to fetch history:', err)
        }
    }, [user.id])

    useEffect(() => {
        fetchData()
        fetchHistory()
    }, [fetchData, fetchHistory])

    useEffect(() => {
        if (!selectedProject) {
            setMilestones([])
            setTasks([])
            setSelectedMilestone('')
            setSelectedTask('')
            return
        }
        const filteredMilestones = Array.from(new Set(allTasks
            .filter(t => (t.sow_milestones as any)?.sows?.id === selectedProject)
            .map(t => JSON.stringify({
                id: (t.sow_milestones as any)?.id,
                title: (t.sow_milestones as any)?.title
            }))
        )).map(m => JSON.parse(m))

        setMilestones(filteredMilestones)
        setSelectedMilestone('')
        setSelectedTask('')
    }, [selectedProject, allTasks])

    useEffect(() => {
        if (!selectedMilestone) {
            setTasks([])
            setSelectedTask('')
            return
        }
        const filteredTasks = allTasks
            .filter(t => t.sow_milestone_id === selectedMilestone)
            .map(t => ({
                id: t.id,
                title: t.title
            }))

        setTasks(filteredTasks)
        setSelectedTask('')
    }, [selectedMilestone, allTasks])

    const toggleTracking = async () => {
        const electron = (window as any).electron
        if (!electron?.ipcRenderer) return

        if (stats.isTracking) {
            await electron.ipcRenderer.invoke('stop-tracking')
            setStats(prev => ({ ...prev, isTracking: false, isPaused: false, elapsedSeconds: 0, keystrokes: 0, clicks: 0 }))
            setSelectedProject('')
            setSelectedMilestone('')
            setSelectedTask('')
            setWorkDescription('')
            fetchHistory()
        } else {
            if (!selectedTask) {
                alert('Please select a task before starting.')
                return
            }
            await electron.ipcRenderer.invoke('start-tracking', {
                projectId: selectedProject,
                milestoneId: selectedMilestone,
                taskId: selectedTask,
                workDescription
            })
            setStats(prev => ({ ...prev, isTracking: true, isPaused: false, elapsedSeconds: 0, keystrokes: 0, clicks: 0 }))
        }
    }

    const togglePause = async () => {
        const electron = (window as any).electron
        if (!electron?.ipcRenderer) return

        const newPausedState = !stats.isPaused
        if (stats.isPaused) {
            await electron.ipcRenderer.invoke('resume-tracking')
        } else {
            await electron.ipcRenderer.invoke('pause-tracking')
        }
        setStats(prev => ({ ...prev, isPaused: newPausedState }))
    }

    const resetTimer = async () => {
        const electron = (window as any).electron
        if (!electron?.ipcRenderer) return

        await electron.ipcRenderer.invoke('reset-tracking')
        setStats(prev => ({ ...prev, elapsedSeconds: 0, keystrokes: 0, clicks: 0 }))
    }

    const saveManualEntry = async () => {
        if (!manualDate || !manualStartTime || !manualEndTime) {
            alert('Please fill in date and both times.')
            return
        }

        const startFullStr = `${manualDate}T${manualStartTime}`
        const endFullStr = `${manualDate}T${manualEndTime}`
        const start = new Date(startFullStr).getTime()
        const end = new Date(endFullStr).getTime()
        const diff = end - start

        if (isNaN(diff) || diff <= 0) {
            alert('Please enter valid start and end times. End time must be after start time.')
            return
        }

        const durationSeconds = Math.floor(diff / 1000)

        setIsSavingManual(true)
        try {
            const electron = (window as any).electron
            if (!electron?.ipcRenderer) return

            const success = await electron.ipcRenderer.invoke('save-manual-log', {
                userId: user.id,
                projectId: selectedProject,
                milestoneId: selectedMilestone,
                taskId: selectedTask,
                workDescription,
                durationSeconds,
                timestamp: new Date(startFullStr).toISOString()
            })

            if (success) {
                setManualStartTime('')
                setManualEndTime('')
                setSelectedProject('')
                setSelectedMilestone('')
                setSelectedTask('')
                setWorkDescription('')

                fetchHistory()
                fetchData()
                alert('Manual entry saved successfully!')
            } else {
                alert('Failed to save manual entry.')
            }
        } catch (err) {
            console.error('Save manual entry error:', err)
            alert('An error occurred while saving.')
        } finally {
            setIsSavingManual(false)
        }
    }


    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white p-6 overflow-hidden relative">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="text-blue-500" /> SentinelTrack
                    </h1>
                    <p className="text-sm text-gray-400">Logged in as {user.email}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsManualEntry(!isManualEntry)}
                        className={`text-sm font-bold px-4 py-2 rounded-full transition-all border ${isManualEntry
                            ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                            : 'bg-slate-800 border-slate-700 text-gray-400 hover:text-white'
                            }`}
                        disabled={stats.isTracking}
                    >
                        {isManualEntry ? 'Auto Track' : 'Manual Entry'}
                    </button>
                    <button onClick={onLogout} className="text-sm text-red-400 hover:text-red-300">Sign Out</button>
                </div>
            </div>

            <div className="flex gap-6 h-full overflow-hidden">
                <div className="flex-1 flex flex-col overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl mb-6">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Target size={14} /> Task Assignment
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Project</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    value={selectedProject}
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                    disabled={stats.isTracking}
                                >
                                    <option value="">Select Project</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Milestone</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                        value={selectedMilestone}
                                        onChange={(e) => setSelectedMilestone(e.target.value)}
                                        disabled={stats.isTracking || !selectedProject}
                                    >
                                        <option value="">Select Milestone</option>
                                        {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Task</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                        value={selectedTask}
                                        onChange={(e) => setSelectedTask(e.target.value)}
                                        disabled={stats.isTracking || !selectedMilestone}
                                    >
                                        <option value="">Select Task</option>
                                        {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Work Description</label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500 h-20 resize-none"
                                    placeholder="What are you working on?"
                                    value={workDescription}
                                    onChange={(e) => setWorkDescription(e.target.value)}
                                    disabled={stats.isTracking}
                                />
                            </div>
                        </div>
                    </div>

                    {!isManualEntry ? (
                        <>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-800 p-4 rounded-lg flex flex-col items-center">
                                    <Keyboard className="text-green-400 mb-2" size={24} />
                                    <span className="text-2xl font-bold">{stats.keystrokes}</span>
                                    <span className="text-xs text-gray-500 uppercase">Keystrokes</span>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-lg flex flex-col items-center">
                                    <MousePointer className="text-blue-400 mb-2" size={24} />
                                    <span className="text-2xl font-bold">{stats.clicks}</span>
                                    <span className="text-xs text-gray-500 uppercase">Clicks</span>
                                </div>
                            </div>

                            <div className="text-center mb-6">
                                <div className="text-6xl font-mono font-bold mb-4 tabular-nums">
                                    {formatTime(stats.elapsedSeconds)}
                                </div>
                                <div className="flex items-center justify-center gap-6">
                                    <button
                                        onClick={toggleTracking}
                                        className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-all ${stats.isTracking
                                            ? 'border-red-500 bg-red-500/10 hover:bg-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                                            : 'border-green-500 bg-green-500/10 hover:bg-green-500/20 text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                                            }`}
                                    >
                                        <Power size={32} />
                                        <span className="font-bold mt-1 text-xs">{stats.isTracking ? 'STOP' : 'START'}</span>
                                    </button>

                                    {stats.isTracking && (
                                        <button
                                            onClick={togglePause}
                                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-lg ${stats.isPaused
                                                ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                                                : 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30'
                                                }`}
                                            title={stats.isPaused ? 'Resume' : 'Pause'}
                                        >
                                            {stats.isPaused ? <Play size={20} /> : <Pause size={20} />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-4 bg-slate-800/40 p-2 px-4 rounded-full border border-slate-700/50 mb-6">
                                <div className="flex gap-2 border-r border-slate-700 pr-4 mr-2">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${stats.isTracking ? (stats.isPaused ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50' : 'bg-green-900/50 text-green-400 border border-green-700/50') : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'}`}>
                                        {stats.isTracking ? (stats.isPaused ? 'PAUSED' : 'TRACKING') : 'READY'}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${stats.isIdle ? 'bg-orange-900/50 text-orange-400 border border-orange-700/50' : 'bg-blue-900/50 text-blue-400 border border-blue-700/50'}`}>
                                        {stats.isIdle ? 'IDLE' : 'ACTIVE'}
                                    </span>
                                </div>

                                <button
                                    onClick={resetTimer}
                                    className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors group"
                                    title="Reset Current Timer"
                                >
                                    <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
                                    RESET
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl mb-6">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <FileText size={14} /> Manual Time Entry
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-2 block">Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                                        value={manualDate}
                                        onChange={(e) => setManualDate(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold mb-2 block">Start Time</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                                            value={manualStartTime}
                                            onChange={(e) => setManualStartTime(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold mb-2 block">End Time</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                                            value={manualEndTime}
                                            onChange={(e) => setManualEndTime(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {manualDate && manualStartTime && manualEndTime && (
                                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 text-center">
                                        <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Calculated Duration</span>
                                        <span className="text-3xl font-mono font-bold text-blue-400">
                                            {(() => {
                                                const start = new Date(`${manualDate}T${manualStartTime}`).getTime()
                                                const end = new Date(`${manualDate}T${manualEndTime}`).getTime()
                                                const diff = end - start
                                                if (isNaN(diff) || diff < 0) return '00:00:00'
                                                return formatTime(Math.floor(diff / 1000))
                                            })()}
                                        </span>
                                    </div>
                                )}

                                <button
                                    onClick={saveManualEntry}
                                    disabled={isSavingManual || !selectedTask || !manualStartTime || !manualEndTime}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSavingManual ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            SAVING...
                                        </>
                                    ) : (
                                        'SAVE MANUAL ENTRY'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-80 border-l border-slate-800 pl-6 flex flex-col h-full overflow-hidden">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <History size={14} /> Recent Activity
                    </h3>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 pb-6">
                        {history.length === 0 ? (
                            <p className="text-gray-500 text-center py-8 bg-slate-800/20 rounded-lg italic text-sm">No activity logged.</p>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="bg-slate-800/50 p-3 rounded-lg flex flex-col border border-slate-700/30 hover:bg-slate-800/80 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-gray-500 text-[9px] uppercase font-bold tabular-nums">
                                            {new Date(item.log_timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-blue-400 font-mono font-bold text-sm">
                                            {formatTime(item.duration_seconds || 0)}
                                        </span>
                                    </div>

                                    {(item.project?.title || item.milestone?.title || item.task?.title) && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {item.project?.title && (
                                                <span className="bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase truncate max-w-[120px]" title={item.project.title}>
                                                    {item.project.title}
                                                </span>
                                            )}
                                            {item.milestone?.title && (
                                                <span className="bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase truncate max-w-[120px]" title={item.milestone.title}>
                                                    {item.milestone.title}
                                                </span>
                                            )}
                                            {item.task?.title && (
                                                <span className="bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase truncate max-w-[120px]" title={item.task.title}>
                                                    {item.task.title}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {item.work_description && (
                                        <p className="text-[10px] text-gray-400 line-clamp-2 mb-2 italic">"{item.work_description}"</p>
                                    )}
                                    <div className="flex gap-4 text-[9px] border-t border-slate-700/50 pt-2">
                                        <div className="flex gap-1">
                                            <span className="text-gray-500 uppercase">Keys:</span>
                                            <span className="font-bold text-white">{item.keystroke_count}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <span className="text-gray-500 uppercase">Clicks:</span>
                                            <span className="font-bold text-white">{item.click_count}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
