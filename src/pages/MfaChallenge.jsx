import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Login qilingandan keyin, agar foydalanuvchida 2FA yoqilgan bo'lsa,
 * shu sessiyada autentifikator kodini tasdiqlash uchun ko'rsatiladi.
 */
export default function MfaChallenge({ onVerified, onSignOut }) {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [factorId, setFactorId] = useState(null)
  const [loadingFactor, setLoadingFactor] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadFactor() {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (!isMounted) return

      if (error) {
        setErrorMsg(error.message)
        setLoadingFactor(false)
        return
      }

      const totpFactor = data.totp?.find((f) => f.status === 'verified')
      setFactorId(totpFactor?.id ?? null)
      setLoadingFactor(false)
    }

    loadFactor()
    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!factorId) return
    setSubmitting(true)
    setErrorMsg(null)

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })
    if (challengeError) {
      setErrorMsg(challengeError.message)
      setSubmitting(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyError) {
      setErrorMsg('Kod noto\u2018g\u2018ri yoki muddati o\u2018tgan. Qaytadan urinib ko\u2018ring.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onVerified()
  }

  return (
    <div style={styles.shell}>
      <div style={styles.panel}>
        <h1 style={styles.title}>Xavfsizlik tekshiruvi</h1>
        <p style={styles.subtitle}>
          Autentifikator ilovangizdagi 6 xonali kodni kiriting.
        </p>

        {loadingFactor && <p style={styles.subtitle}>Tekshirilmoqda...</p>}

        {!loadingFactor && factorId && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={styles.input}
              placeholder="000000"
            />
            {errorMsg && <div style={styles.error}>{errorMsg}</div>}
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              style={styles.submitBtn}
            >
              {submitting ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
            </button>
          </form>
        )}

        {!loadingFactor && !factorId && (
          <div style={styles.error}>
            {errorMsg ?? 'Tasdiqlangan autentifikator omili topilmadi.'}
          </div>
        )}

        <button onClick={onSignOut} style={styles.signOutLink}>
          Chiqish
        </button>
      </div>
    </div>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 24,
    background: 'radial-gradient(circle at 50% -10%, #16233a 0%, var(--shell-navy-deep) 65%)',
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '32px 28px',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--canvas-text)' },
  subtitle: { marginTop: 6, marginBottom: 24, fontSize: 14, color: 'var(--canvas-text-muted)' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    fontSize: 24,
    letterSpacing: '0.3em',
    textAlign: 'center',
    padding: '12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid #ddd2bf',
    background: 'var(--canvas-raised)',
    color: 'var(--canvas-text)',
  },
  error: { fontSize: 13, color: 'var(--danger)' },
  submitBtn: {
    marginTop: 8,
    padding: '11px 16px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  signOutLink: {
    marginTop: 16,
    background: 'transparent',
    border: 'none',
    color: 'var(--canvas-text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
}
