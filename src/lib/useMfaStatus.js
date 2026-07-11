import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

/**
 * Joriy foydalanuvchining 2FA (TOTP) holatini kuzatib boradi:
 * - hasVerifiedTotp: foydalanuvchida tasdiqlangan autentifikator omili bormi
 * - needsChallenge: shu sessiyada 2FA kodi hali tasdiqlanmaganmi (login qilingandan keyin,
 *   lekin autentifikator kodi hali kiritilmagan holat)
 */
export function useMfaStatus(session) {
  const [mfaLoading, setMfaLoading] = useState(true)
  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false)
  const [needsChallenge, setNeedsChallenge] = useState(false)

  const refresh = useCallback(async () => {
    if (!session) {
      setMfaLoading(false)
      setHasVerifiedTotp(false)
      setNeedsChallenge(false)
      return
    }

    setMfaLoading(true)

    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const verifiedTotp = (factorsData?.totp ?? []).some(
      (f) => f.status === 'verified'
    )
    setHasVerifiedTotp(verifiedTotp)

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setNeedsChallenge(
      aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2'
    )

    setMfaLoading(false)
  }, [session])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { mfaLoading, hasVerifiedTotp, needsChallenge, refreshMfaStatus: refresh }
}
