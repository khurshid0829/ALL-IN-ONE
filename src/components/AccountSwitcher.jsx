import { useState, useRef, useEffect } from 'react'

/**
 * "Hozir: [bo'lim] ▾" — Bigmanager panelining Account Switcher'i.
 * DECISIONS.md (2026-07-13) qaroriga mos: bir nechta bo'lim hisobi
 * brauzerda saqlanadi, almashish parolsiz va bir zumda bo'ladi.
 */
export default function AccountSwitcher({
  currentAppUserId,
  currentDepartmentName,
  accounts,
  onSwitch,
  onAdd,
  onRemove,
  switching,
  adding,
  addError,
  clearAddError,
}) {
  const [open, setOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleOpen() {
    setOpen((v) => !v)
    setShowAddForm(false)
    clearAddError?.()
  }

  async function handleSwitch(appUserId) {
    if (appUserId === currentAppUserId || switching) return
    const ok = await onSwitch(appUserId)
    if (ok) setOpen(false)
  }

  async function handleAddSubmit(e) {
    e.preventDefault()
    const ok = await onAdd(email, password)
    if (ok) {
      setEmail('')
      setPassword('')
      setShowAddForm(false)
    }
  }

  return (
    <div ref={containerRef} style={styles.container}>
      <button type="button" style={styles.trigger} onClick={toggleOpen}>
        Hozir: <strong>{currentDepartmentName ?? '—'}</strong> <span style={styles.caret}>&#9662;</span>
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.sectionLabel}>Ulangan hisoblar</div>

          <div style={styles.accountList}>
            {accounts.map((acc) => (
              <div
                key={acc.appUserId}
                style={{
                  ...styles.accountRow,
                  ...(acc.appUserId === currentAppUserId ? styles.accountRowActive : {}),
                }}
              >
                <button
                  type="button"
                  style={styles.accountBtn}
                  onClick={() => handleSwitch(acc.appUserId)}
                  disabled={switching}
                >
                  <span style={styles.accountDept}>
                    {acc.appUserId === currentAppUserId ? '✓ ' : ''}
                    {acc.departmentName ?? '—'}
                  </span>
                  <span style={styles.accountEmail}>{acc.email}</span>
                </button>
                {acc.appUserId !== currentAppUserId && (
                  <button
                    type="button"
                    title="Ro'yxatdan olib tashlash"
                    style={styles.removeBtn}
                    onClick={() => onRemove(acc.appUserId)}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>

          {switching && <div style={styles.statusText}>Almashtirilmoqda...</div>}

          <div style={styles.divider} />

          {!showAddForm ? (
            <button
              type="button"
              style={styles.addToggleBtn}
              onClick={() => setShowAddForm(true)}
            >
              + Boshqa hisob qo'shish
            </button>
          ) : (
            <form onSubmit={handleAddSubmit} style={styles.addForm}>
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="Boshqa bo'lim emaili"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.addInput}
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Parol"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.addInput}
              />
              {addError && <div style={styles.addError}>{addError}</div>}
              <div style={styles.addFormActions}>
                <button type="submit" disabled={adding} style={styles.addSubmitBtn}>
                  {adding ? 'Tekshirilmoqda...' : "Qo'shish"}
                </button>
                <button
                  type="button"
                  style={styles.addCancelBtn}
                  onClick={() => {
                    setShowAddForm(false)
                    clearAddError?.()
                  }}
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { position: 'relative' },
  trigger: {
    background: 'transparent',
    border: '1px solid var(--shell-line)',
    color: 'var(--on-navy)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 13,
  },
  caret: { fontSize: 10, color: 'var(--on-navy-muted)' },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 280,
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '14px 14px 16px',
    zIndex: 20,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: '0.04em',
    color: 'var(--canvas-text-muted)',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  accountList: { display: 'flex', flexDirection: 'column', gap: 6 },
  accountRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 6,
    borderRadius: 8,
    background: 'var(--canvas-raised)',
    border: '1px solid #e6dcc7',
  },
  accountRowActive: {
    border: '1px solid var(--copper)',
  },
  accountBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    background: 'transparent',
    border: 'none',
    padding: '8px 10px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  accountDept: { fontSize: 13, fontWeight: 600, color: 'var(--canvas-text)' },
  accountEmail: { fontSize: 11, color: 'var(--canvas-text-muted)' },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--canvas-text-muted)',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 10px',
  },
  statusText: { marginTop: 8, fontSize: 12, color: 'var(--canvas-text-muted)' },
  divider: { height: 1, background: '#e6dcc7', margin: '12px 0' },
  addToggleBtn: {
    width: '100%',
    background: 'transparent',
    border: '1px dashed var(--copper)',
    color: 'var(--copper)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  addForm: { display: 'flex', flexDirection: 'column', gap: 8 },
  addInput: {
    padding: '8px 10px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid #ddd2bf',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 13,
  },
  addError: { fontSize: 12, color: 'var(--danger)' },
  addFormActions: { display: 'flex', gap: 8 },
  addSubmitBtn: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  addCancelBtn: {
    padding: '8px 10px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'transparent',
    color: 'var(--canvas-text-muted)',
    fontSize: 12,
    cursor: 'pointer',
  },
}
