import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './styles/index.css'
import App from './App'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
    throw new Error("Missing Publishable Key")
}

// Global error tracking for debugging IPC issues
window.onerror = (message, source, lineno, colno, error) => {
    console.error('GLOBAL ERROR:', message, 'at', source, ':', lineno, ':', colno, error)
    return false
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            navigate={(to) => {
                console.log('CLERK NAVIGATION ATTEMPT:', to);
                // In a no-router app, we don't actually navigate, but we need to know where it wants to go
            }}
        >
            <App />
        </ClerkProvider>
    </React.StrictMode>
)
