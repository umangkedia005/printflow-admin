import { useCallback, useEffect, useState } from 'react'
import { fetchGarmentsAdmin, reviewGarment } from './api'
import { C, SERIF, panel, input, label, button, primary, outline } from './theme'
import Heading from './Heading'

const TYPE = { tee: 'Round-neck T-shirt', polo: 'Polo', hoodie: 'Hoodie' }
const STATUS = {
  pending: ['Waiting for review', C.goldWash, C.gold],
  approved: ['Approved', C.greenWash, C.green],
  rejected: ['Rejected', C.redWash, C.red],
}

function Photo({ url, box, label: text }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: '10px', overflow: 'hidden', background: C.wash, border: `1px solid ${C.rule}` }}>
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', maxWidth: 'none', display: 'block' }} />}
      {url && box && (
        <div style={{ position: 'absolute', left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, border: `1.5px dashed ${C.blue}`, background: 'rgba(43,91,168,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: C.blue }}>{text}</div>
      )}
    </div>
  )
}

// One garment: its photos with print boxes the reviewer can adjust.
function Review({ g, onDone }) {
  const [areas, setAreas] = useState(() => (g.areas || []).map(a => ({ ...a, remove: false, mockup_box: { ...a.mockup_box } })))
  const [note, setNote] = useState(g.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(g.status !== 'approved')
  const editable = editing
  // What the team charges for the garment itself, per size.
  const [prices, setPrices] = useState(() => Object.fromEntries((g.sizes || []).map(s => [s, g.prices?.[s] ?? ''])))
  const unpriced = (g.sizes || []).filter(s => !(Number(prices[s]) > 0))
  const set = (id, patch) => setAreas(list => list.map(a => (a.id === id ? { ...a, ...patch } : a)))
  const setBox = (id, k, v) => setAreas(list => list.map(a => (a.id === id ? { ...a, mockup_box: { ...a.mockup_box, [k]: v } } : a)))
  // The box's height follows the print area's real proportions.
  const boxOf = a => ({ ...a.mockup_box, h: a.mockup_box.w * Number(a.height_in || 1) / Number(a.width_in || 1) })

  async function decide(decision) {
    if (decision === 'reject' && !note.trim()) return setError('Add a note so the customer knows what to fix.')
    if (decision === 'approve' && unpriced.length) return setError(`Set the garment price for ${unpriced.join(', ')}.`)
    setBusy(true)
    setError('')
    try {
      await reviewGarment({
        email: g.email, garment_id: g.garment_id, decision, note,
        prices: Object.fromEntries(Object.entries(prices).map(([s, v]) => [s, Number(v)])),
        areas: areas.map(a => ({ id: a.id, remove: a.remove, width_in: Number(a.width_in), height_in: Number(a.height_in), print_cost: Number(a.print_cost), mockup_box: { x: Number(a.mockup_box.x), y: Number(a.mockup_box.y), w: Number(a.mockup_box.w) } })),
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const [statusText, bg, fg] = STATUS[g.status] || STATUS.pending
  return (
    <div style={{ ...panel, padding: '22px 26px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: '20px', color: C.ink }}>{g.name}</div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{g.email}</span>·<span>{TYPE[g.type] || g.type}</span>·
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.color?.hex, border: `1px solid ${C.rule}` }} />{g.color?.name}·
            <span>Sizes {(g.sizes || []).join(', ')}</span>
          </div>
        </div>
        <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{statusText}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
        {areas.map(a => (
          <div key={a.id} style={{ opacity: a.remove ? 0.45 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: C.ink, marginBottom: '6px' }}>
              <span>{a.label}</span>
              {editable && <label style={{ fontWeight: 400, color: C.muted, display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={a.remove} onChange={e => set(a.id, { remove: e.target.checked })} />Don't print here</label>}
            </div>
            <Photo url={g.photo_urls?.[a.view_id]} box={boxOf(a)} label={`${Number(a.width_in)}″ × ${Number(a.height_in)}″`} />
            {editable && !a.remove && (
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[['width_in', 'Width ″'], ['height_in', 'Height ″'], ['print_cost', 'Cost ₹']].map(([k, text]) => (
                  <div key={k}><span style={{ ...label, marginBottom: '3px' }}>{text}</span><input style={{ ...input, padding: '6px 8px' }} type="number" min="0" step="0.5" value={a[k]} onChange={e => set(a.id, { [k]: e.target.value })} /></div>
                ))}
                {[['x', 'Left'], ['y', 'Top'], ['w', 'Box size']].map(([k, text]) => (
                  <div key={k} style={{ gridColumn: 'span 3' }}>
                    <span style={{ ...label, marginBottom: '0' }}>{text}</span>
                    <input type="range" min={k === 'w' ? 0.05 : 0} max={k === 'w' ? 0.9 : 0.95} step="0.005" value={a.mockup_box[k]} onChange={e => setBox(a.id, k, Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                ))}
              </div>
            )}
            {!editable && <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>₹{Number(a.print_cost)} per piece</div>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '18px' }}>
        <span style={label}>GARMENT PRICE PER PIECE ₹ (what the customer pays for the garment, before printing)</span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {(g.sizes || []).map(s => (
            <div key={s} style={{ width: '90px' }}>
              <span style={{ ...label, marginBottom: '3px' }}>{s}</span>
              {editable
                ? <input style={{ ...input, padding: '6px 8px' }} type="number" min="1" step="1" value={prices[s]} onChange={e => setPrices(p => ({ ...p, [s]: e.target.value }))} />
                : <div style={{ fontSize: '13px', color: g.prices?.[s] ? C.ink : C.red }}>{g.prices?.[s] ? `₹${Number(g.prices[s])}` : 'Not set'}</div>}
            </div>
          ))}
        </div>
      </div>

      {editable ? (
        <div style={{ marginTop: '18px' }}>
          <span style={label}>NOTE FOR THE CUSTOMER (required to reject)</span>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Approved: courier the garments to our Pune unit. Or: the back photo is blurry, please retake it." style={{ ...input, resize: 'vertical' }} />
          {error && <div style={{ color: C.red, fontSize: '12px', marginTop: '8px' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            {g.status === 'approved' && <button style={button} disabled={busy} onClick={() => setEditing(false)}>Cancel</button>}
            <button style={outline} disabled={busy} onClick={() => decide('reject')}>Reject</button>
            <button style={primary} disabled={busy} onClick={() => decide('approve')}>{busy ? 'Saving…' : g.status === 'approved' ? 'Save changes' : 'Approve'}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
          <div style={{ fontSize: '12px', color: C.muted }}>{g.note ? `Note: ${g.note}` : ''}</div>
          <button style={{ ...button, padding: '6px 14px', fontSize: '12px' }} onClick={() => setEditing(true)}>Edit price & positions</button>
        </div>
      )}
    </div>
  )
}

export default function GarmentsAdmin() {
  const [garments, setGarments] = useState(null)
  const [error, setError] = useState('')
  const [show, setShow] = useState('pending')

  const load = useCallback(() => {
    fetchGarmentsAdmin().then(setGarments).catch(err => { setError(err.message); setGarments([]) })
  }, [])
  useEffect(() => { load() }, [load])

  const count = s => (garments || []).filter(g => g.status === s).length
  const list = (garments || []).filter(g => show === 'all' || g.status === show)
  return (
    <>
      <Heading eyebrow="Customers' own garments" title="Garments">
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['pending', `Waiting (${count('pending')})`], ['approved', `Approved (${count('approved')})`], ['rejected', `Rejected (${count('rejected')})`], ['all', 'All']].map(([id, text]) => (
            <button key={id} onClick={() => setShow(id)} style={{ ...(show === id ? primary : button), padding: '6px 14px', fontSize: '12px' }}>{text}</button>
          ))}
        </div>
      </Heading>
      <p style={{ color: C.muted, fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>Garment styles customers want; we source them. Check the photos, adjust where printing goes, set the garment price per size and the print costs, then approve or reject.</p>
      {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 14px', borderRadius: '10px' }}>{error}</div>}
      {garments === null ? (
        <div style={{ color: C.muted, fontFamily: SERIF, fontSize: '16px' }}>Loading garments…</div>
      ) : list.length === 0 ? (
        <div style={{ ...panel, padding: '48px', textAlign: 'center', color: C.muted, fontFamily: SERIF, fontSize: '16px' }}>{show === 'pending' ? 'Nothing waiting for review.' : 'No garments here.'}</div>
      ) : list.map(g => <Review key={`${g.email}-${g.garment_id}-${g.status}`} g={g} onDone={load} />)}
    </>
  )
}
