import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * 2FA (TOTP) yoqish ekrani.
 * mandatory=true bo'lsa, "Keyinroq" tugmasi ko'rsatilmaydi (Founder/Bigmanager uchun).
 */
export default function MfaSetup({ mandatory, onEnrolled, onSignOut, onSkip }) {
  const [qrCode, setQrCode] = useState(null)
  const [secret, setSecret] = useState(null)
  const [factorId, setFactorId] = useState(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [loadingEnroll, setLoadingEnroll] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function startEnroll() {
      setLoadingEnroll(true)
      setErrorMsg(null)

      try {
        const { data: existing } = await supabase.auth.mfa.listFactors()
        const unverified = existing?.totp?.find((f) => f.status !== 'verified')
        if (unverified) {
          await supabase.auth.mfa.unenroll({ factorId: unverified.id })
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Autentifikator ilova',
        })

        if (!isMounted) return

        if (error) {
          setErrorMsg(error.message)
          setLoadingEnroll(false)
          return
        }

        setQrCode(data.totp.qr_code)
        setSecret(data.totp.secret)
        setFactorId(data.id)
        setLoadingEnroll(false)
      } catch (err) {
        if (!isMounted) return
        setErrorMsg(err.message ?? 'Kutilmagan xatolik yuz berdi.')
        setLoadingEnroll(false)
      }
    }

    startEnroll()
    return () => {
      isMounted = false
    }
  }, [])

  async function handleVerify(e) {
    e.preventDefault()
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
      setErrorMsg('Kod noto\u2018g\u2018ri. Ilovadagi joriy kodni qaytadan kiriting.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onEnrolled()
  }

  return (
    <div style={styles.shell}>
      <div style={styles.panel}>
        <h1 style={styles.title}>Ikki bosqichli tasdiqlashni yoqish</h1>
        <p style={styles.subtitle}>
          {mandatory
            ? 'Sizning rolingiz uchun bu qadam majburiy \u2014 davom etish uchun sozlang.'
            : 'Hisobingizni qo\u2018shimcha himoya bilan ta\u2019minlang.'}
        </p>

        {loadingEnroll && <p style={styles.subtitle}>Tayyorlanmoqda...</p>}

        {!loadingEnroll && qrCode && (
          <>
            <ol style={styles.steps}>
              <li>Telefoningizga Google Authenticator (yoki shunga o\u2018xshash) ilovasini o\u2018rnating</li>
              <li>Ilovada &quot;+&quot; tugmasini bosib, quyidagi QR kodni skanerlang</li>
              <li>Ilovada chiqqan 6 xonali kodni pastga kiriting</li>
            </ol>

            <div style={styles.qrWrap}>
              <img src={qrCode} alt="QR kod" style={styles.qrImg} />
            </div>

            <p style={styles.secretNote}>
              QR skanerlab bo\u2018lmasa, shu kodni qo\u2018lda kiriting:
              <br />
              <code style={styles.secretCode}>{secret}</code>
            </p>

            <form onSubmit={handleVerify} style={styles.form}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
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
                {submitting ? 'Tekshirilmoqda...' : 'Tasdiqlash va yoqish'}
              </button>
            </form>
          </>
        )}

        {!loadingEnroll && !qrCode && errorMsg && (
          <div style={styles.error}>{errorMsg}</div>
        )}

        <div style={styles.footerRow}>
          {!mandatory && onSkip && (
            <button onClick={onSkip} style={styles.linkBtn}>
              Keyinroq
            </button>
          )}
          <button onClick={onSignOut} style={styles.linkBtn}>
            Chiqish
          </button>
        </div>
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
    maxWidth: 420,
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '32px 28px',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--canvas-text)' },
  subtitle: { marginTop: 6, marginBottom: 20, fontSize: 14, color: 'var(--canvas-text-muted)' },
  steps: {
    fontSize: 13,
    color: 'var(--canvas-text)',
    paddingLeft: 18,
    margin: '0 0 20px 0',
    lineHeight: 1.6,
  },
  qrWrap: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  qrImg: { width: 180, height: 180, background: '#fff', padding: 8, borderRadius: 8 },
  secretNote: {
    fontSize: 12,
    color: 'var(--canvas-text-muted)',
    textAlign: 'center',
    marginBottom: 20,
  },
  secretCode: { fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' },
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
  footerRow: { display: 'flex', justifyContent: 'center', gap: 20, marginTop: 20 },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--canvas-text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
}
