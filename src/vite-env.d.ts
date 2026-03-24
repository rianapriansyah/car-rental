/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SHOW_ADMIN_BOOTSTRAP?: string
  /** Optional. Origin for invite email redirect (e.g. https://app.example.com). Defaults to window.location.origin. */
  readonly VITE_PARTNER_INVITE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
