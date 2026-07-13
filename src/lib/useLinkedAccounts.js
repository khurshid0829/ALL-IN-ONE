import { useState, useEffect, useCallback } from 'react'
import { supabase, createEphemeralClient } from './supabaseClient'

const STORAGE_KEY = 'ybt_bigmanager_linked_accounts'

/**
 * Bir shaxs bir nechta bo'limda Bigmanager bo'lganda (har bo'limga alohida
 * login, DECISIONS.md 2026-07-09), bir nechta Supabase sessiyasini brauzerda
 * saqlab, ular orasida parolsiz (bir zumda) almashish imkonini beradi
 * (DECISIONS.md 2026-07-13 — Account Switcher qarori).
 *
 * Faqat Bigmanager roli uchun ishlaydi. Tokenlar localStorage'da saqlanadi —
 * bu Supabase'ning o'zi ham asosiy sessiyani xuddi shu tarzda (localStorage)
 * saqlashi bilan bir xil xavfsizlik darajasida.
 */
export function useLinkedAccounts(session, profile) {
  const [accounts, setAccounts] = useState(() => loadStored())
  const [switching, setSwitching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  // Joriy faol sessiyani ro'yxatga qo'shish/yangilash — shu bilan token
  // yangilanishlari (Supabase avtomatik refresh) ham doim saqlanib boradi.
  useEffect(() => {
    if (!session || !profile || profile.role !== 'Bigmanager') return

    setAccounts((prev) => {
      const next = upsertAccount(prev, {
        appUserId: profile.appUserId,
        email: session.user.email,
        departmentId: profile.departmentId,
        departmentName: profile.departmentName,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      })
      saveStored(next)
      return next
    })
  }, [session, profile])

  const addAccount = useCallback(async (email, password) => {
    setAdding(true)
    setAddError(null)

    const temp = createEphemeralClient()

    const { data: signInData, error: signInError } = await temp.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData.session) {
      setAddError('Email yoki parol noto‘g‘ri.')
      setAdding(false)
      return false
    }

    const { data: profileData, error: profileError } = await temp
      .from('app_users')
      .select('id, role, department_id, departments(name)')
      .eq('auth_user_id', signInData.session.user.id)
      .single()

    if (profileError) {
      setAddError('Profil topilmadi: ' + profileError.message)
      setAdding(false)
      return false
    }

    if (profileData.role !== 'Bigmanager') {
      setAddError('Bu hisob Bigmanager roliga ega emas, shuning uchun qo‘shib bo‘lmaydi.')
      setAdding(false)
      return false
    }

    setAccounts((prev) => {
      const next = upsertAccount(prev, {
        appUserId: profileData.id,
        email,
        departmentId: profileData.department_id,
        departmentName: profileData.departments?.name ?? null,
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
      })
      saveStored(next)
      return next
    })

    setAdding(false)
    return true
  }, [])

  const switchAccount = useCallback(async (appUserId) => {
    const target = accounts.find((a) => a.appUserId === appUserId)
    if (!target) return false

    setSwitching(true)

    const { error } = await supabase.auth.setSession({
      access_token: target.accessToken,
      refresh_token: target.refreshToken,
    })

    setSwitching(false)

    if (error) {
      // Saqlangan token endi yaroqsiz — ro'yxatdan olib tashlaymiz,
      // foydalanuvchi "Hisob qo'shish" orqali qayta ulashi kerak bo'ladi.
      setAccounts((prev) => {
        const next = prev.filter((a) => a.appUserId !== appUserId)
        saveStored(next)
        return next
      })
      return false
    }

    return true
  }, [accounts])

  const removeAccount = useCallback((appUserId) => {
    setAccounts((prev) => {
      const next = prev.filter((a) => a.appUserId !== appUserId)
      saveStored(next)
      return next
    })
  }, [])

  return {
    accounts,
    addAccount,
    switchAccount,
    removeAccount,
    switching,
    adding,
    addError,
    clearAddError: () => setAddError(null),
  }
}

function upsertAccount(list, account) {
  const next = list.filter((a) => a.appUserId !== account.appUserId)
  next.push(account)
  return next
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveStored(accounts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // localStorage yo'q/to'lgan bo'lsa ham tizim ishlashda davom etadi,
    // faqat almashish keyingi sahifa yuklanishida saqlanmagan bo'ladi.
  }
}
