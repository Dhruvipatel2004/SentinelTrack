import React, { useState, useEffect } from 'react';
// @ts-ignore
import { X, Check, Image as ImageIcon, Send, Trash2 } from 'lucide-react';

export default function ScreenshotPopup() {
    const [data, setData] = useState<any>(null);
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const electron = (window as any).electron;
        if (electron?.ipcRenderer) {
            electron.ipcRenderer.on('screenshot-data', (screenshotData: any) => {
                setData(screenshotData);
                setDescription(screenshotData.aiDescription || '');
            });
        }
    }, []);

    const handleSave = async () => {
        if (!data || isSaving) return;
        setIsSaving(true);
        try {
            const electron = (window as any).electron;
            const success = await electron.ipcRenderer.invoke('save-screenshot', {
                userId: data.metadata.userId,
                dataUrl: data.image,
                description: description,
                metadata: data.metadata,
                token: data.metadata.token // We might need to ensure token is passed in metadata
            });
            // Main process will close the window on success
        } catch (error) {
            console.error('Failed to save screenshot:', error);
            setIsSaving(false);
        }
    };

    const handleDiscard = async () => {
        const electron = (window as any).electron;
        await electron.ipcRenderer.invoke('close-screenshot-popup');
    };

    if (!data) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <ImageIcon className="text-blue-500" size={32} />
                    <p className="text-xs font-medium">Analyzing Screen...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-slate-900 border border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 drag-region">
                <h2 className="text-xs font-bold flex items-center gap-2 text-white">
                    <ImageIcon className="text-blue-400" size={14} />
                    Screenshot captured
                </h2>
                <button
                    onClick={handleDiscard}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Image Preview */}
            <div className="flex-1 bg-black relative overflow-hidden group">
                <img
                    src={data.image}
                    alt="Current Screen"
                    className="w-full h-full object-contain"
                />
                <div className="absolute bottom-2 right-2 text-[10px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded">
                    {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* Description & Actions */}
            <div className="p-4 space-y-3 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800">
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">
                        AI suggestion
                    </label>
                    <div className="relative group">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 h-16 resize-none placeholder-gray-600 transition-all"
                            placeholder="Add a note..."
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={handleDiscard}
                        disabled={isSaving}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700 flex items-center justify-center gap-1.5"
                    >
                        <Trash2 size={12} />
                        Discard
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-[2] px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <span className="animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white" />
                        ) : (
                            <>
                                <Send size={12} />
                                Save & Sync
                            </>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                .drag-region {
                    -webkit-app-region: drag;
                }
                button {
                    -webkit-app-region: no-drag;
                }
                textarea {
                    -webkit-app-region: no-drag;
                }
            `}</style>
        </div>
    );
}
