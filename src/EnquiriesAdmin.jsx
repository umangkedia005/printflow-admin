import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchEnquiries, updateEnquiry } from './api'
import { C, SERIF, panel, input, button, primary } from './theme'
import Heading from './Heading'

// Enquiries: bulk / custom / brand enquiries from the dashboard's
// "Bulk & Custom" page (each is also emailed to the support inbox).
// Move each one along (New → Contacted → Quoted → Won / Closed) and keep a
// note of what was said, so nothing gets lost in the inbox.

const STATUS = {
  new: ['New', C.goldWash, C.gold],
  contacted: ['Contacted', C.blueWash, C.blue],
  quoted: ['Quoted', '#F1ECFA', '#6B4BA8'],
  won: ['Won', C.greenWash, C.green],
  closed: ['Closed', C.wash, C.muted],
}
const FILTERS = ['all', 'new', 'contacted', 'quoted', 'won', 'closed']
const when = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const ago = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${Math.max(m, 1)} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function Chip({ children }) {
  return <span style={{ fontSize: '12px', color: C.inkSoft, background: C.wash, border: `1px solid ${C.ruleSoft}`, borderRadius: '8px', padding: '3px 9px' }}>{children}</span>
}

function EnquiryCard({ e, onSaved }) {
  const [status, setStatus] = useState(e.status || 'new')
  const [note, setNote] = useState(e.note || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const dirty = status !== (e.status || 'new') || note !== (e.note || '')
  const [label, bg, fg] = STATUS[e.status] || STATUS.new
  const who = e.brand || e.name
  const phone = String(e.phone || '')
  const wa = `https://wa.me/91${phone}?text=${encodeURIComponent(`Hi ${e.name}, this is No Limit Studio about your ${String(e.type || 'enquiry').toLowerCase()} enquiry.`)}`
  const mail = `mailto:${e.email}?subject=${encodeURIComponent(`Your enquiry · ${e.type} · No Limit Studio`)}`

  async function save() {
    setBusy(true); setMsg(null)
    try {
      onSaved((await updateEnquiry(e.enquiry_id, status, note)).enquiry)
      setMsg({ ok: true, text: 'Saved' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...panel, padding: '18px 20px', display: 'flex', gap: '20px', flexWrap: 'wrap', borderLeft: e.status === 'new' ? `3px solid ${C.gold}` : `1px solid ${C.rule}` }}>
      <div style={{ flex: '1 1 380px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ background: bg, color: fg, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px' }}>{label}</span>
          <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gold, fontWeight: 600 }}>{e.type}</span>
          <span style={{ fontSize: '12px', color: C.muted }} title={when(e.created_at)}>{ago(e.created_at)} · {e.enquiry_id}</span>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: '20px', color: C.ink, marginTop: '8px' }}>{who}</div>
        <div style={{ fontSize: '13px', color: C.inkSoft, marginTop: '2px' }}>
          {e.brand ? `${e.name} · ` : ''}<a href={`tel:+91${phone}`} style={{ color: C.ink }}>+91 {phone}</a> · <a href={mail} style={{ color: C.ink }}>{e.email}</a>
          {e.account && e.account !== e.email && <span style={{ color: C.muted }}> · account {e.account}</span>}
        </div>
        {(e.product || e.quantity || e.timeline) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            {e.product && <Chip>{e.product}</Chip>}
            {e.quantity && <Chip>{Number(e.quantity).toLocaleString('en-IN')} pcs</Chip>}
            {e.timeline && <Chip>Needed: {e.timeline}</Chip>}
          </div>
        )}
        <div style={{ fontSize: '14px', color: C.ink, lineHeight: 1.6, marginTop: '12px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: C.paper, borderRadius: '10px', padding: '12px 14px' }}>{e.message}</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <a href={`tel:+91${phone}`} style={{ ...button, textDecoration: 'none' }}>Call</a>
          <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...button, textDecoration: 'none' }}>WhatsApp</a>
          <a href={mail} style={{ ...button, textDecoration: 'none' }}>Email</a>
        </div>
      </div>

      <div style={{ flex: '0 1 280px', minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: C.muted, letterSpacing: '0.04em' }}>STATUS</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {Object.entries(STATUS).map(([id, [text, sbg, sfg]]) => (
            <button key={id} onClick={() => setStatus(id)} aria-pressed={status === id}
              style={{ ...button, padding: '5px 11px', fontSize: '12px', background: status === id ? sbg : 'transparent', color: status === id ? sfg : C.inkSoft, border: `1px solid ${status === id ? sfg : C.rule}`, fontWeight: status === id ? 600 : 500 }}>{text}</button>
          ))}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: C.muted, letterSpacing: '0.04em', marginTop: '4px' }}>NOTE (ONLY THE TEAM SEES THIS)</div>
        <textarea value={note} maxLength={2000} onChange={ev => setNote(ev.target.value)} placeholder="e.g. Called on 22 Nov, sent quote ₹289/pc for 300, waiting for reply"
          style={{ ...input, minHeight: '84px', resize: 'vertical', lineHeight: 1.5 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button style={primary} disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          {msg && <span style={{ fontSize: '12px', color: msg.ok ? C.green : C.red }}>{msg.ok ? '✓ ' : ''}{msg.text}</span>}
          {e.updated_at && !msg && <span style={{ fontSize: '11px', color: C.muted }}>Updated {ago(e.updated_at)}</span>}
        </div>
      </div>
    </div>
  )
}

export default function EnquiriesAdmin() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    setError('')
    fetchEnquiries().then(d => setList(d.enquiries)).catch(e => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c = { all: (list || []).length }
    for (const e of list || []) c[e.status || 'new'] = (c[e.status || 'new'] || 0) + 1
    return c
  }, [list])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list || []).filter(e => (filter === 'all' || (e.status || 'new') === filter)
      && (!s || [e.name, e.brand, e.email, e.phone, e.account, e.product, e.message, e.enquiry_id, e.note].some(v => String(v || '').toLowerCase().includes(s))))
  }, [list, filter, q])

  const saved = updated => setList(l => l.map(e => e.enquiry_id === updated.enquiry_id ? { ...e, ...updated } : e))

  return (
    <div>
      <Heading eyebrow="Bulk & Custom" title="Enquiries">
        {counts.new > 0 && <span style={{ fontSize: '12px', fontWeight: 600, color: C.gold, background: C.goldWash, padding: '5px 12px', borderRadius: '99px' }}>{counts.new} new</span>}
        <button style={button} onClick={load}>Refresh</button>
      </Heading>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <input style={{ ...input, flex: '1 1 260px', width: 'auto', borderRadius: '99px', padding: '10px 18px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, brand, phone, email, message or note" />
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={filter === f ? primary : button}>
            {f === 'all' ? 'All' : STATUS[f][0]}{counts[f] ? ` ${counts[f]}` : ''}
          </button>
        ))}
      </div>

      {error && <div style={{ ...panel, padding: '14px 18px', color: C.red, background: C.redWash, marginBottom: '14px' }}>{error}</div>}
      {list === null && !error && <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>Loading…</div>}
      {list && shown.length === 0 && (
        <div style={{ ...panel, padding: '56px 24px', textAlign: 'center', color: C.muted, fontFamily: SERIF, fontSize: '16px' }}>
          {list.length === 0 ? 'No enquiries yet. They appear here when a brand sends one from Bulk & Custom.' : 'Nothing matches.'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {shown.map(e => <EnquiryCard key={`${e.enquiry_id}-${e.updated_at || ''}`} e={e} onSaved={saved} />)}
      </div>
    </div>
  )
}
