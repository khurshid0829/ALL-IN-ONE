import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

/**
 * Joriy login qilgan foydalanuvchi va uning app_users jadvalidagi
 * rol/bo'lim ma'lumotini kuzatib boradi.
 *
 * DIQQAT: quyidagi so'rovda 'departments(name)' deb yozilgan — agar sizning
 * departments jadvalingizda nom ustuni boshqacha nomlangan bo'lsa
 * (masalan 'nomi' yoki 'display_name'), shu qatorni moslashtirish kerak bo'ladi.
 */
export function useAppSession() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // { role, department_id, department_name }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadProfile(currentSession) {
      if (!currentSession) {
        if (isMounted) {
          setProfile(null)
          setLoading(false)
        }
        return
      }

      const { data, error: profileError } = await supabase
        .from('app_users')
        .select('role, department_id, departments(name)')
        .eq('auth_user_id', currentSession.user.id)
        .single()

      if (!isMounted) return

      if (profileError) {
        setError(profileError.message)
        setProfile(null)
      } else {
        setProfile({
          role: data.role,
          departmentId: data.department_id,
          departmentName: data.departments?.name ?? null,
        })
        setError(null)
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return
      setSession(initialSession)
      loadProfile(initialSession)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(true)
      loadProfile(newSession)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { session, profile, loading, error }
}
