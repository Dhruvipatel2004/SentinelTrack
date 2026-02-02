import { useState, useEffect, useRef } from 'react'
import { SignedIn, SignedOut, SignIn, useAuth, useUser } from '@clerk/clerk-react'
import Dashboard from './components/Dashboard'
import ScreenshotPopup from './components/ScreenshotPopup'
import { supabase } from './lib/supabase'

function App(): JSX.Element {
  const [isPopup, setIsPopup] = useState(window.location.hash === '#screenshot-popup')

  useEffect(() => {
    const handleHashChange = () => {
      setIsPopup(window.location.hash === '#screenshot-popup')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (isPopup) {
    return <ScreenshotPopup />
  }

  return (
    <>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900">
          <SignIn
            routing="virtual"
            afterSignInUrl="/"
            appearance={{
              variables: {
                colorPrimary: '#2563eb',
                colorBackground: '#1e293b',
                colorText: '#ffffff',
                colorInputBackground: '#334155',
                colorInputText: '#ffffff',
              }
            }}
          />
        </div>
      </SignedOut>
    </>
  )
}
const waitForElectron = async (timeout = 5000): Promise<boolean> => {
  const start = Date.now()

  while (!(window as any).electron?.ipcRenderer) {
    if (Date.now() - start > timeout) {
      return false
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return true
}

function AuthenticatedApp() {
  const { getToken, signOut } = useAuth()
  const { user } = useUser()

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasSyncedRef = useRef(false)

  useEffect(() => {
    const sync = async () => {
      if (!user) return
      if (hasSyncedRef.current) return
      hasSyncedRef.current = true

      console.log('Syncing session for user:', user.id)

      try {
        // 1️⃣ Get Supabase JWT from Clerk
        const token = await getToken({ template: 'supabase' })
        if (!token) {
          setError('Missing Clerk Supabase JWT template')
          return
        }

        // 2️⃣ Set Supabase session in renderer
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: ''
        })

        // 3️⃣ Wait for Electron (optional but preferred)
        const electronReady = await waitForElectron()
        if (!electronReady) {
          console.warn('Electron not available, running in browser mode')
          setReady(true)
          return
        }

        const electron = (window as any).electron

        // 4️⃣ Sync with main process
        await electron.ipcRenderer.invoke('set-user-id', user.id)
        await electron.ipcRenderer.invoke('set-supabase-session', token)

        console.log('Electron sync completed')
        setReady(true)

      } catch (err: any) {
        console.error('Session sync failed:', err)
        setError(err.message || 'Session sync failed')
      }
    }

    sync()
  }, [user, getToken])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => signOut()} className="bg-blue-600 px-4 py-2 rounded">
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        Initializing session…
      </div>
    )
  }

  return (
    <Dashboard
      user={{ id: user.id, email: user.primaryEmailAddress?.emailAddress }}
      onLogout={() => signOut()}
    />
  )
}


export default App


