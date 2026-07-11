export default function RolePlaceholder({ role, departmentName, onSignOut }) {
  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi</span>
        <button style={styles.signOutBtn} onClick={onSignOut}>
          Chiqish
        </button>
      </header>

      <main style={styles.panel}>
        <h1 style={styles.title}>Xush kelibsiz</h1>
        <p style={styles.text}>
          Rolingiz: <strong>{role}</strong>
          {departmentName ? (
            <>
              {' '}
              &middot; Bo'lim: <strong>{departmentName}</strong>
            </>
          ) : null}
        </p>
        <p style={styles.text}>
          Bu rol uchun ekran hali qurilmagan &mdash; kiritish formalari
          (ombor, savdo, ishlab chiqarish) keyingi bosqichlarda quriladi.
        </p>
      </main>
    </div>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    background: 'var(--shell-navy)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--shell-line)',
  },
  brand: {
    color: 'var(--on-navy)',
    fontSize: 14,
  },
  signOutBtn: {
    background: 'transparent',
    border: '1px solid var(--shell-line)',
    color: 'var(--on-navy-muted)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 13,
  },
  panel: {
    maxWidth: 560,
    margin: '48px auto',
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    padding: '32px 28px',
    boxShadow: 'var(--shadow-panel)',
  },
  title: {
    margin: 0,
    color: 'var(--canvas-text)',
    fontSize: 20,
  },
  text: {
    marginTop: 12,
    color: 'var(--canvas-text-muted)',
    fontSize: 15,
    lineHeight: 1.5,
  },
}
