import { createBrowserClient } from '@supabase/ssr'

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function createClient() {
  // Use direct NEXT_PUBLIC refs so Next.js can inline these in browser builds.
  const url = stripWrappingQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  const anonKey = stripWrappingQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createBrowserClient(
    url,
    anonKey
  )
}
