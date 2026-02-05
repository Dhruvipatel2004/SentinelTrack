import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

type TokenGetter = () => Promise<string | null>
let tokenGetter: TokenGetter | null = null

export function setSupabaseTokenGetter(getter: TokenGetter | null) {
    tokenGetter = getter
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    accessToken: async () => (tokenGetter ? await tokenGetter() : null)
})
