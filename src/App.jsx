import { useAppSession } from './lib/useAppSession'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import FounderDashboard from './pages/FounderDashboard'
import RolePlaceholder from './pages/RolePlaceholder'

export default function App() {
  const { session, profile, loading, error } = useAppSession()

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (!session) {
    return <Login />
  }

  if (loading) {
    return <CenteredMessage text="Yuklanmoqda..." />
  }

  if (error) {
    return (
      <CenteredMessage
        text={
          'Profil topilmadi. app_users jadvalida shu foydalanuvchi uchun ' +
          "qator bormi tekshiring. Xato: " +
          error
        }
        onSignOut={handleSignOut}
      />
    )
  }

  if (profile?.role === 'Founder') {
    return <FounderDashboard onSignOut={handleSignOut} />
  }

  return (
    <RolePlaceholder
      role={profile?.role ?? 'Nomaʼlum'}
      departmentName={profile?.departmentName}
      onSignOut={handleSignOut}
    />
  )
}

function CenteredMessage({ text, onSignOut }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--shell-navy)',
        color: 'var(--on-navy)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <p>{text}</p>
      {onSignOut && (
        <button
          onClick={onSignOut}
          style={{
            background: 'transparent',
            border: '1px solid var(--shell-line)',
            color: 'var(--on-navy-muted)',
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Chiqish
        </button>
      )}
    </div>
  )
}
