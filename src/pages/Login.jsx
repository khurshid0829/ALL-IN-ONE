import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg('Email yoki parol noto\u2018g\u2018ri. Qaytadan urinib ko\u2018ring.')
      setSubmitting(false)
    }
    // Muvaffaqiyatli bo'lsa, useAppSession hook o'zi sessiyani ushlab oladi
    // va App.jsx tegishli sahifaga yo'naltiradi.
  }

  return (
    <div style={styles.shell}>
      <div style={styles.brandRow}>
        <span style={styles.brandMark}>YBT</span>
        <span style={styles.brandName}>Yagona Boshqaruv Tizimi</span>
      </div>

      <div style={styles.panel}>
        <h1 style={styles.title}>Tizimga kirish</h1>
        <p style={styles.subtitle}>
          Ish email va parolingiz bilan kiring.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="ism.familiya+bolim@gmail.com"
          />

          <label style={styles.label} htmlFor="password">
            Parol
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          {errorMsg && <div style={styles.error}>{errorMsg}</div>}

          <button type="submit" disabled={submitting} style={styles.submitBtn}>
            {submitting ? 'Tekshirilmoqda...' : 'Kirish'}
          </button>
        </form>
      </div>

      <p style={styles.footnote}>
        Muzqaymoq &middot; Chuchvara &middot; Vafli &middot; Shokolad &middot; Sirok
      </p>
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
    gap: 32,
    padding: 24,
    background:
      'radial-gradient(circle at 50% -10%, #16233a 0%, var(--shell-navy-deep) 65%)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    letterSpacing: '0.12em',
    color: 'var(--shell-navy)',
    background: 'var(--copper)',
    padding: '4px 8px',
    borderRadius: 6,
    fontWeight: 600,
  },
  brandName: {
    color: 'var(--on-navy)',
    fontSize: 15,
    letterSpacing: '0.02em',
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '32px 28px',
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--canvas-text)',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 24,
    fontSize: 14,
    color: 'var(--canvas-text-muted)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--canvas-text)',
    marginTop: 12,
  },
  input: {
    fontSize: 15,
    padding: '10px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid #ddd2bf',
    background: 'var(--canvas-raised)',
    color: 'var(--canvas-text)',
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: 'var(--danger)',
  },
  submitBtn: {
    marginTop: 22,
    padding: '11px 16px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  footnote: {
    color: 'var(--on-navy-muted)',
    fontSize: 12,
    letterSpacing: '0.04em',
  },
}
