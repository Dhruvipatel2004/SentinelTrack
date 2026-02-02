import React, { useState } from 'react';
// @ts-ignore
import { X, Check, Image as ImageIcon } from 'lucide-react';

interface ScreenshotApprovalProps {
    imageUrl: string;
    metadata: any;
    onSubmit: (description: string) => void;
    onCancel: () => void;
}

export function ScreenshotApproval({ imageUrl, metadata, onSubmit, onCancel }: ScreenshotApprovalProps) {
    const [description, setDescription] = useState(metadata.workDescription || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        await onSubmit(description);
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <ImageIcon className="text-blue-400" size={20} />
                        Screenshot Captured
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-hidden flex flex-col gap-6">

                    {/* Image Preview */}
                    <div className="relative flex-1 bg-black rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center group">
                        <img
                            src={imageUrl}
                            alt="Screenshot Preview"
                            className="max-w-full max-h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                            <p className="text-xs text-gray-300">
                                {new Date().toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Metadata & Description */}
                    <div className="space-y-4">
                        <div className="flex gap-4 text-xs text-gray-400">
                            {metadata.projectId && <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">Project: {metadata.projectId}</span>}
                            {/* Ideally map ID to Name if possible, but ID is what we have unless we pass names */}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                                Work Description (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 h-24 resize-none placeholder-gray-600"
                                placeholder="Add a note about this screenshot..."
                                autoFocus
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/30 rounded-b-xl">
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                    >
                        {isSubmitting ? 'Uploading...' : (
                            <>
                                <Check size={16} />
                                Submit Trigger
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
