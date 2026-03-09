/**
 * Supabase sync for admin_clubs — keeps data in sync across devices (Vercel + all clients).
 * Uses env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 * Table: app_store with key (text PK), value (jsonb). Key used: "admin_clubs".
 */

import { createClient } from '@supabase/supabase-js'

const STORE_KEY = 'admin_clubs'
let _client = null
let _clientChecked = false

function getSupabaseClient() {
  if (_clientChecked) return _client
  _clientChecked = true
  const url = import.meta.env?.VITE_SUPABASE_URL
  const anon = import.meta.env?.VITE_SUPABASE_ANON_KEY
  if (!url || !anon || typeof url !== 'string' || typeof anon !== 'string') {
    return null
  }
  try {
    _client = createClient(url.trim(), anon.trim())
    return _client
  } catch (e) {
    console.warn('Supabase client init failed:', e)
    return null
  }
}

/**
 * Fetch admin_clubs from Supabase. Returns null if not configured or error.
 * @returns {Promise<Array|null>}
 */
export async function getRemoteClubs() {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('app_store')
      .select('value')
      .eq('key', STORE_KEY)
      .maybeSingle()
    if (error) {
      console.warn('Supabase getRemoteClubs error:', error.message)
      return null
    }
    const raw = data?.value
    if (raw == null) return null
    const arr = Array.isArray(raw) ? raw : (raw?.clubs && Array.isArray(raw.clubs) ? raw.clubs : null)
    return arr
  } catch (e) {
    console.warn('getRemoteClubs failed:', e)
    return null
  }
}

/**
 * Upsert admin_clubs to Supabase (fire-and-forget). No-op if not configured.
 * @param {Array} clubs
 */
export async function setRemoteClubs(clubs) {
  const supabase = getSupabaseClient()
  if (!supabase || !Array.isArray(clubs)) return
  try {
    const { error } = await supabase
      .from('app_store')
      .upsert({ key: STORE_KEY, value: clubs }, { onConflict: 'key' })
    if (error) console.warn('Supabase setRemoteClubs error:', error.message)
  } catch (e) {
    console.warn('setRemoteClubs failed:', e)
  }
}

/**
 * Subscribe to real-time changes of admin_clubs. When another device adds/edits data,
 * callback is called with the new clubs array so the UI can update without refresh.
 * @param {(clubs: Array) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToClubs(callback) {
  const supabase = getSupabaseClient()
  if (!supabase || typeof callback !== 'function') return () => {}
  const channel = supabase
    .channel('app_store_clubs')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_store', filter: `key=eq.${STORE_KEY}` },
      async () => {
        const clubs = await getRemoteClubs()
        if (clubs && Array.isArray(clubs)) callback(clubs)
      }
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

export { getSupabaseClient }
