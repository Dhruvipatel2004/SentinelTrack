import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './styles/index.css'
import App from './App'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
    const rootElement = document.getElementById('root')
    if (rootElement) {
        rootElement.innerHTML = `
            <div style="background-color: #0f172a; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; text-align: center; padding: 20px;">
                <div>
                    <h1 style="color: #f87171;">Configuration Error</h1>
                    <p>Missing <b>VITE_CLERK_PUBLISHABLE_KEY</b> in environment variables.</p>
                    <p style="font-size: 0.8em; color: #94a3b8;">Please ensure your .env file contains this key and you rebuild the application.</p>
                </div>
            </div>
        `
    }
    throw new Error("Missing Publishable Key")
}

// Global error tracking for debugging IPC issues
window.addEventListener('error', (event) => {
    console.error('GLOBAL ERROR:', event.error);
    const rootElement = document.getElementById('root');
    if (rootElement && rootElement.innerHTML.trim() === '') {
        rootElement.innerHTML = `
            <div style="background-color: #0f172a; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; text-align: center; padding: 20px;">
                <div>
                    <h1 style="color: #f87171;">Runtime Error</h1>
                    <p>${event.message}</p>
                    <p style="font-size: 0.8em; color: #94a3b8;">Source: ${event.filename}:${event.lineno}</p>
                </div>
            </div>
        `;
    }
});

try {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
        <React.StrictMode>
            <ClerkProvider
                publishableKey={PUBLISHABLE_KEY}
                navigate={(to) => {
                    console.log('CLERK NAVIGATION ATTEMPT:', to);
                }}
            >
                <App />
            </ClerkProvider>
        </React.StrictMode>
    )
} catch (err: any) {
    console.error('FAILED TO RENDER APP:', err);
    const rootElement = document.getElementById('root');
    if (rootElement) {
        rootElement.innerHTML = `
            <div style="background-color: #0f172a; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; text-align: center; padding: 20px;">
                <div>
                    <h1 style="color: #f87171;">Bootstrap Error</h1>
                    <p>${err.message || 'Unknown error during React initialization'}</p>
                    <p style="margin-top: 20px;">
                        <a href="https://github.com/Dhruvipatel2004/SentinelTrack/issues" 
                           style="color: #60a5fa; text-decoration: underline;" 
                           target="_blank" rel="noopener noreferrer">
                           Report this issue on GitHub
                        </a>
                    </p>
                </div>
            </div>
        `;
    }
}