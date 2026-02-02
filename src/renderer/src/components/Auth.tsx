import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth({ onLogin }: { onLogin: (user: any) => void }) {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        alert(error.message)
        setLoading(false)
    } else if (data.user) {
        // CRITICAL: Tell the main process who logged in BEFORE calling onLogin
        const electron = (window as any).electron
        if (electron?.ipcRenderer) {
            await electron.ipcRenderer.invoke('set-user-id', data.user.id)
            // If you are using Supabase RLS, you might also need to pass the session
            const { data: sessionData } = await supabase.auth.getSession()
            if (sessionData.session) {
                await electron.ipcRenderer.invoke('set-supabase-session', sessionData.session.access_token)
            }
        }
       
        onLogin(data.user) 
    }
}

    const handleSignUp = async () => {
    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        alert(error.message);
    } else {
        alert('Check your email for the login link!');
    }
    setLoading(false);
};

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
            <div className="p-8 bg-slate-800 rounded-lg shadow-lg w-80">
                <h1 className="mb-6 text-2xl font-bold text-center">SentinelTrack</h1>
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <input
                        className="p-2 text-black rounded"
                        type="email"
                        placeholder="Your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        className="p-2 text-black rounded"
                        type="password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                        className="p-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700"
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Sign In'}
                    </button>
                    <button
                        type="button"
                        className="p-2 text-sm text-gray-400 hover:text-white"
                        onClick={handleSignUp}
                        disabled={loading}
                    >
                        Sign Up
                    </button>
                </form>
            </div>
        </div>
    )
}
