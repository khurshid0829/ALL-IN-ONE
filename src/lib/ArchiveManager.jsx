import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ARCHIVE_ENTITIES } from '../lib/archiveEntities'

/**
 * Universal arxivlash ekrani.
 * - Founder: faqat ko'radi (tugmalar ko'rinmaydi) — barcha bo'limlar bo'yicha.
 * - Bigmanager: o'z bo'limida arxivlaydi/qaytaradi (RLS baza darajasida ham
 *   shuni majburlaydi — frontend bu yerda faqat tugmani ko'rsatish/yashirishni
 *   boshqaradi, haqiqiy ruxsat baza tomonidan tekshiriladi).
 */
export default function ArchiveManager({ role, onBack, onSignOut }) {
  const readOnly = role === 'Founder'

  const [entityKey, setEntityKey] = useState(ARCHIVE_ENTITIES[0].key)
  const [filter, setFilter] = useState('active') // 'active' | 'archived' | 'all'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const entity = ARCHIVE_ENTITIES.find((e) => e.key === entityKey)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    let query = supabase
      .from(entity.table)
      .select(entity.selectColumns)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (filter === 'active') {
      query = query.eq('is_archived', false)
    } else if (filter === 'archived') {
      query = query.eq('is_archived', true)
    }

    const { data, error } = await query

    if (error) {
      setErrorMsg(error.message)
      setRows([])
    } else {
      setRows(data ?? [])
    }
    setLoading(false)
  }, [entity, filter])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  async function handleToggle(row) {
    if (readOnly) return
    setBusyId(row.id)
    setErrorMsg(null)

    const { error } = await supabase
      .from(entity.table)
      .update({ is_archived: !row.is_archived })
      .eq('id', row.id)

    if (error) {
      setErrorMsg(
        'Amal bajarilmadi (ehtimol bu yozuv boshqa bo\u2018limga tegishli): ' +
          error.message
      )
      setBusyId(null)
      return
    }

    setBusyId(null)
    loadRows()
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Arxiv boshqaruvi</span>
        <div style={styles.headerActions}>
          <button style={styles.secondaryBtn} onClick={onBack}>
            &larr; Orqaga
          </button>
          <button style={styles.signOutBtn} onClick={onSignOut}>
            Chiqish
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {readOnly && (
          <div style={styles.readOnlyNote}>
            Siz faqat ko'rish rejimidasiz &mdash; Founder roli arxivlash/qaytarish
            huquqiga ega emas.
          </div>
        )}

        <div style={styles.controlsRow}>
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Jadval</label>
            <select
              value={entityKey}
              onChange={(e) => setEntityKey(e.target.value)}
              style={styles.select}
            >
              {ARCHIVE_ENTITIES.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Holat</label>
            <div style={styles.tabRow}>
              {[
                { key: 'active', label: 'Faol' },
                { key: 'archived', label: 'Arxivlangan' },
                { key: 'all', label: 'Hammasi' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  style={{
                    ...styles.tabBtn,
                    ...(filter === tab.key ? styles.tabBtnActive : {}),
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

        <div style={styles.panel}>
          {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

          {!loading && rows.length === 0 && (
            <p style={styles.emptyText}>Bu bo'limda hozircha yozuv yo'q.</p>
          )}

          {!loading && rows.length > 0 && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {entity.columns.map((col) => (
                      <th
                        key={col.key}
                        style={col.isNumber ? styles.thRight : styles.th}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th style={styles.th}>Holat</th>
                    {!readOnly && <th style={styles.th}></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      {entity.columns.map((col) => (
                        <td
                          key={col.key}
                          style={col.isNumber ? styles.tdRight : styles.td}
                          className={col.isNumber ? 'mono-figure' : undefined}
                        >
                          {col.derive ? col.derive(row) : row[col.key] ?? '\u2014'}
                        </td>
                      ))}
                      <td style={styles.td}>
                        {row.is_archived ? (
                          <span style={styles.badgeArchived}>Arxivlangan</span>
                        ) : (
                          <span style={styles.badgeActive}>Faol</span>
                        )}
                      </td>
                      {!readOnly && (
                        <td style={styles.td}>
                          <button
                            onClick={() => handleToggle(row)}
                            disabled={busyId === row.id}
                            style={
                              row.is_archived
                                ? styles.restoreBtn
                                : styles.archiveBtn
                            }
                          >
                            {busyId === row.id
                              ? '...'
                              : row.is_archived
                              ? 'Qaytarish'
                              : 'Arxivlash'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const styles = {
  shell: { minHeight: '100vh', background: 'var(--shell-navy)' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--shell-line)',
  },
  headerActions: { display: 'flex', gap: 10 },
  brand: { color: 'var(--on-navy)', fontSize: 14, letterSpacing: '0.02em' },
  secondaryBtn: {
    background: 'transparent',
    border: '1px solid var(--shell-line)',
    color: 'var(--on-navy-muted)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 13,
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
  main: {
    maxWidth: 1040,
    margin: '32px auto',
    padding: '0 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  readOnlyNote: {
    background: '#182234',
    border: '1px solid var(--shell-line)',
    color: 'var(--on-navy-muted)',
    padding: '10px 14px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
  },
  controlsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 24,
    alignItems: 'flex-end',
  },
  controlGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  controlLabel: {
    fontSize: 12,
    color: 'var(--on-navy-muted)',
    letterSpacing: '0.04em',
  },
  select: {
    padding: '8px 10px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'var(--canvas)',
    color: 'var(--canvas-text)',
    fontSize: 14,
    minWidth: 220,
  },
  tabRow: { display: 'flex', gap: 6 },
  tabBtn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'transparent',
    color: 'var(--on-navy-muted)',
    cursor: 'pointer',
    fontSize: 13,
  },
  tabBtnActive: {
    background: 'var(--copper)',
    borderColor: 'var(--copper)',
    color: '#fff',
    fontWeight: 600,
  },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '12px 16px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
  },
  panel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '20px 20px 24px',
  },
  statusText: { color: 'var(--canvas-text-muted)' },
  emptyText: { color: 'var(--canvas-text-muted)', fontSize: 14 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
  },
  thRight: {
    textAlign: 'right',
    padding: '8px 10px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    whiteSpace: 'nowrap',
  },
  tdRight: {
    padding: '10px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  badgeActive: {
    fontSize: 12,
    color: 'var(--teal)',
    background: 'var(--teal-soft)',
    padding: '3px 8px',
    borderRadius: 999,
  },
  badgeArchived: {
    fontSize: 12,
    color: 'var(--danger)',
    background: '#f0dcd5',
    padding: '3px 8px',
    borderRadius: 999,
  },
  archiveBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--danger)',
    background: 'transparent',
    color: 'var(--danger)',
    cursor: 'pointer',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  restoreBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--teal)',
    background: 'transparent',
    color: 'var(--teal)',
    cursor: 'pointer',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
}
