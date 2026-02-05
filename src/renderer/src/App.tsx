import { useState, useEffect, useRef } from 'react'
import { SignedIn, SignedOut, SignIn, useAuth, useUser } from '@clerk/clerk-react'
import { setSupabaseTokenGetter } from './lib/supabase'
import Dashboard from './components/Dashboard'
import ScreenshotPopup from './components/ScreenshotPopup'

function App(): JSX.Element {
  const [isPopup, setIsPopup] = useState(window.location.hash === '#screenshot-popup')

  useEffect(() => {
    const handleHashChange = () => {
      setIsPopup(window.location.hash === '#screenshot-popup')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (isPopup) return <ScreenshotPopup />

  return (
    <>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
      <SignedOut>
        <div className="flex items-center justify-center h-screen bg-slate-900">
          <SignIn routing="virtual" afterSignInUrl="/" />
        </div>
      </SignedOut>
    </>
  )
}

function AuthenticatedApp() {
  const { signOut, getToken } = useAuth()
  const { user } = useUser()
  const syncedRef = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!user) return
    setSupabaseTokenGetter(() => getToken({ template: 'supabase' }) || getToken())
  }, [user, getToken])

  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.ipcRenderer || !user) return
    const handler = async () => {
      const token = await getToken({ template: 'supabase' }) || await getToken()
      await electron.ipcRenderer.invoke('fresh-token-response', token ?? null)
    }
    electron.ipcRenderer.on('request-fresh-token', handler)
    return () => {
      electron.ipcRenderer.off('request-fresh-token', handler)
    }
  }, [user, getToken])

  useEffect(() => {
    if (!user || syncedRef.current) return
    syncedRef.current = true

    const electron = (window as any).electron
    if (!electron?.ipcRenderer) {
      setReady(true)
      return
    }

    const init = async () => {
      electron.ipcRenderer.invoke('set-user-id', user.id)
      const token = await getToken({ template: 'supabase' }) || await getToken()
      if (token) await electron.ipcRenderer.invoke('set-supabase-session', token)
      await electron.ipcRenderer.invoke('register-user', {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        fullName: user.fullName ?? ''
      })
      setReady(true)
    }
    init()
  }, [user, getToken])

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        Initializing…
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
