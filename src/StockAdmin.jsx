import { useCallback, useEffect, useState } from 'react'
import { fetchBlanks, saveStock } from './api'
import { C, SERIF, panel, input, button, primary } from './theme'
import Heading from './Heading'

// Stock: how many pieces of each colour / size are on hand. Orders don't
// change these numbers; update them here when stock comes in or runs out.
// Customers see a level only: 0 = out of stock (can't be ordered),
// 1-20 low, 21-50 moderate, more = healthy. Empty = not counted.
const LEVELS = [
  ['out', 'Out of stock', C.redWash, C.red],
  ['low', 'Low', '#FDF1E3', '#B5651D'],
  ['moderate', 'Moderate', C.goldWash, C.gold],
  ['healthy', 'Healthy', C.greenWash, C.green],
]
function level(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return n <= 0 ? 'out' : n <= 20 ? 'low' : n <= 50 ? 'moderate' : 'healthy'
}
const key = (color, size) => `${color}|${size}`

function Blank({ blank, onSaved }) {
  const sizes = [...new Set(blank.variants.map(v => v.size))]
  const start = () => Object.fromEntries(blank.variants.map(v => [key(v.color, v.size), v.stock ?? '']))
  const [counts, setCounts] = useState(start)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const dirty = JSON.stringify(counts) !== JSON.stringify(start())

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const res = await saveStock(blank.blank_id, blank.variants.map(v => ({ color: v.color, size: v.size, stock: counts[key(v.color, v.size)] })))
      onSaved(blank.blank_id, res.variants)
      setMsg({ ok: true, text: 'Saved' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...panel, padding: '18px 22px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: '19px', color: C.ink }}>{blank.name}</div>
          <div style={{ fontSize: '12px', color: C.muted }}>{[blank.gsm && `${blank.gsm} GSM`, blank.fabric].filter(Boolean).join(' · ')}{blank.active === false ? ' · hidden from customers' : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {msg && <span style={{ fontSize: '12px', color: msg.ok ? C.green : C.red }}>{msg.ok ? '✓ ' : ''}{msg.text}</span>}
          <button style={primary} disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save stock'}</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: C.muted, fontWeight: 500 }}>Colour</th>
              {sizes.map(s => <th key={s} style={{ padding: '6px 6px', color: C.muted, fontWeight: 600, minWidth: '86px' }}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {blank.colors.map(c => (
              <tr key={c.name} style={{ borderTop: `1px solid ${C.ruleSoft}` }}>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: c.hex, border: `1px solid ${C.rule}`, marginRight: '8px', verticalAlign: 'middle' }} />{c.name}
                </td>
                {sizes.map(s => {
                  const k = key(c.name, s)
                  if (!(k in counts)) return <td key={s} />
                  const lv = LEVELS.find(l => l[0] === level(counts[k]))
                  return (
                    <td key={s} style={{ padding: '6px', textAlign: 'center' }}>
                      <input style={{ ...input, width: '78px', textAlign: 'center', padding: '7px 6px' }} type="number" min="0" step="1" placeholder="—"
                        value={counts[k]} onChange={e => { setCounts(x => ({ ...x, [k]: e.target.value })); setMsg(null) }} />
                      <div style={{ fontSize: '10px', fontWeight: 600, marginTop: '4px', color: lv ? lv[3] : C.faint }}>{lv ? lv[1] : 'Not counted'}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function StockAdmin() {
  const [blanks, setBlanks] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const load = useCallback(() => { fetchBlanks().then(setBlanks).catch(e => setError(e.message)) }, [])
  useEffect(() => { load() }, [load])

  const onSaved = (id, variants) => setBlanks(bs => bs.map(b => (b.blank_id === id ? { ...b, variants } : b)))
  const shown = (blanks || []).filter(b => !q || `${b.name} ${b.gsm || ''} ${b.fabric || ''}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <Heading eyebrow="Pieces on hand" title="Stock">
        <button style={button} onClick={load}>Refresh</button>
      </Heading>
      <div style={{ ...panel, padding: '14px 18px', marginBottom: '16px', fontSize: '12.5px', color: C.inkSoft, lineHeight: 1.6 }}>
        Type how many pieces you have of each colour and size. Orders don't change these numbers, so update them when stock comes in or runs out.
        Customers only see a level:{' '}
        {LEVELS.map(([id, name, bg, fg]) => <span key={id} style={{ display: 'inline-block', margin: '0 4px', padding: '1px 8px', borderRadius: '99px', background: bg, color: fg, fontWeight: 600, fontSize: '11px' }}>{name}</span>)}
        (0 · 1–20 · 21–50 · 51+). A size at <strong>0</strong> can't be ordered. Leave a box empty to not count it (the Catalogue's in-stock switch is used instead).
      </div>
      <input style={{ ...input, maxWidth: '360px', marginBottom: '16px' }} placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} />
      {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 14px', borderRadius: '10px' }}>{error}</div>}
      {!blanks && !error && <div style={{ color: C.muted, fontSize: '13px' }}>Loading…</div>}
      {shown.map(b => <Blank key={b.blank_id} blank={b} onSaved={onSaved} />)}
      {blanks && !shown.length && <div style={{ color: C.muted, fontSize: '13px' }}>No products match.</div>}
    </div>
  )
}
