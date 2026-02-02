/// <reference types="vite/client" />

declare module '*.png?asset' {
    const src: string
    export default src
}

declare module '*.jpg?asset' {
    const src: string
    export default src
}

declare module '*.svg?asset' {
    const src: string
    export default src
}

declare module '*?asset' {
    const src: string
    export default src
}

interface Window {
    electron: import('@electron-toolkit/preload').ElectronAPI
    api: unknown
}

interface ImportMetaEnv {
    readonly MAIN_VITE_SUPABASE_URL: string
    readonly MAIN_VITE_SUPABASE_ANON_KEY: string
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

