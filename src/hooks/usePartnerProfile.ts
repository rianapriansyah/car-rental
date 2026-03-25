import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PartnerRow } from '../types/partner'

export function usePartnerProfile(authUserId: string | undefined) {
  const [partner, setPartner] = useState<PartnerRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchNonce, setFetchNonce] = useState(0)

  const refetch = useCallback(() => {
    setFetchNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!authUserId) {
      setPartner(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    void supabase
      .from('v2_partners')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
      .then(({ data, error: qError }) => {
        if (cancelled) return
        if (qError) {
          setError(qError.message)
          setPartner(null)
        } else {
          setError(null)
          setPartner(data)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authUserId, fetchNonce])

  return { partner, loading, error, refetch }
}
