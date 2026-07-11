export default function FounderDashboard({ onSignOut }) {
  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Founder</span>
        <button style={styles.signOutBtn} onClick={onSignOut}>
          Chiqish
        </button>
      </header>

      <main style={styles.panel}>
        <h1 style={styles.title}>Kirish tizimi ishladi \u2705</h1>
        <p style={styles.text}>
          Siz Founder sifatida tizimga muvaffaqiyatli kirdingiz. Bu &mdash;
          hozircha vaqtinchalik sahifa: haqiqiy Founder Dashboard (mijozlar
          qarzi, oylik yopish jamlanmasi va boshqalar) keyingi bosqichda shu
          o'rniga quriladi.
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
    letterSpacing: '0.02em',
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
    maxWidth: 640,
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
