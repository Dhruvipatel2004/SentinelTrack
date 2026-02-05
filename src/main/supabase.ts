import { createClient } from '@supabase/supabase-js'

// Use import.meta.env for electron-vite environment variables
export const supabaseUrl = import.meta.env.MAIN_VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
export const supabaseKey = import.meta.env.MAIN_VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

console.log('Main process Supabase URL:', supabaseUrl ? 'Detected' : 'Missing');
console.log('Main process Supabase Key:', supabaseKey ? 'Detected' : 'Missing');

// Clerk JWT; set via setClerkToken() so REST requests use it (avoids setSession which rejects custom JWTs).
let clerkToken: string | null = null
export function setClerkToken(token: string | null) {
    clerkToken = token
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    accessToken: async () => clerkToken ?? null
})
