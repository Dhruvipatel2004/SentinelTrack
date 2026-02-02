import { createClient } from '@supabase/supabase-js'

// These should be loaded from environment variables potentially, 
// but for an Electron app distributed to users, we might need a different auth strategy or public anon key.
// For this MVP, we will rely on process.env which can be bundled or set at runtime.

// Use import.meta.env for electron-vite environment variables
const supabaseUrl = import.meta.env.MAIN_VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = import.meta.env.MAIN_VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

console.log('Main process Supabase URL:', supabaseUrl ? 'Detected' : 'Missing');
console.log('Main process Supabase Key:', supabaseKey ? 'Detected' : 'Missing');

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
})
