import { useEffect, useState } from 'react'
import { fetchSettings, saveSettings, fetchGarmentCosts, saveGarmentCosts } from './api'
import { C, SERIF, panel, input, label, primary } from './theme'
import Heading from './Heading'

const FIELDS = [
  ['surface_first', 'Surface: first item ₹'],
  ['surface_extra', 'Surface: each extra item ₹'],
  ['air_first', 'Air: first item ₹'],
  ['air_extra', 'Air: each extra item ₹'],
  ['product_tax_pct', 'GST on products %'],
  ['shipping_tax_pct', 'GST on shipping %'],
]

// Charges for orders merchants create themselves (Orders → Create order).
export default function SettingsAdmin() {
  const [values, setValues] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings().then(setValues).catch(err => setError(err.message))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      setValues(await saveSettings(Object.fromEntries(FIELDS.map(([k]) => [k, Number(values[k])]))))
      setNotice('Saved. New orders use these rates.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const ship = (method, n) => Number(values?.[`${method}_first`] || 0) + Number(values?.[`${method}_extra`] || 0) * (n - 1)

  return (
    <>
      <Heading eyebrow="Manual orders" title="Shipping and tax">
        <button style={primary} onClick={handleSave} disabled={!values || saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </Heading>
      <p style={{ color: C.muted, fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>Used for orders merchants place themselves from their dashboard and pay from their wallet.</p>
      {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 14px', borderRadius: '10px' }}>{error}</div>}
      {notice && <div style={{ color: C.green, fontSize: '13px', marginBottom: '16px', background: C.greenWash, padding: '10px 14px', borderRadius: '10px' }}>{notice}</div>}
      <div style={{ ...panel, padding: '24px 26px' }}>
        {!values ? (
          <div style={{ color: C.muted, fontFamily: SERIF, fontSize: '16px' }}>Loading settings…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {FIELDS.map(([key, text]) => (
                <div key={key}>
                  <span style={label}>{text}</span>
                  <input style={input} type="number" min="0" step="1" value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${C.ruleSoft}`, marginTop: '20px', paddingTop: '16px', fontSize: '13px', color: C.muted, lineHeight: 1.7 }}>
              <div><span style={{ color: C.ink, fontWeight: 500 }}>Example:</span> 1 item ships for ₹{ship('surface', 1)} surface or ₹{ship('air', 1)} air; 3 items for ₹{ship('surface', 3)} or ₹{ship('air', 3)}.</div>
              <div>GST is added on top: {values.product_tax_pct}% on products and {values.shipping_tax_pct}% on shipping.</div>
            </div>
          </>
        )}
      </div>
      <GarmentCosts />
    </>
  )
}

const GTYPES = [['tee', 'Round-neck T-shirt'], ['polo', 'Polo'], ['hoodie', 'Hoodie']]
const GVIEWS = [['front', 'Front'], ['back', 'Back'], ['left-sleeve', 'Left sleeve'], ['right-sleeve', 'Right sleeve']]

// Default print cost per position for customers' own garments; each new
// garment starts with these and can be changed when reviewing it.
function GarmentCosts() {
  const [costs, setCosts] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { fetchGarmentCosts().then(setCosts).catch(err => setError(err.message)) }, [])
  async function save() {
    setSaving(true); setError(''); setNotice('')
    try {
      const clean = Object.fromEntries(GTYPES.map(([t]) => [t, Object.fromEntries(GVIEWS.map(([v]) => [v, Number(costs[t][v])]))]))
      setCosts(await saveGarmentCosts(clean))
      setNotice('Saved. New garments start with these costs.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div style={{ marginTop: '32px' }}>
      <Heading eyebrow="Customers' own garments" title="Garment print costs">
        <button style={primary} onClick={save} disabled={!costs || saving}>{saving ? 'Saving…' : 'Save costs'}</button>
      </Heading>
      <p style={{ color: C.muted, fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>What printing each position costs, in ₹ per piece, when customers send their own garments. You can still change it per garment when approving.</p>
      {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 14px', borderRadius: '10px' }}>{error}</div>}
      {notice && <div style={{ color: C.green, fontSize: '13px', marginBottom: '16px', background: C.greenWash, padding: '10px 14px', borderRadius: '10px' }}>{notice}</div>}
      <div style={{ ...panel, padding: '20px 26px', overflowX: 'auto' }}>
        {!costs ? <div style={{ color: C.muted, fontFamily: SERIF, fontSize: '16px' }}>Loading…</div> : (
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '520px' }}>
            <thead><tr><th style={{ textAlign: 'left', fontSize: '11px', color: C.muted, fontWeight: 600, padding: '6px' }}></th>{GVIEWS.map(([v, text]) => <th key={v} style={{ textAlign: 'left', fontSize: '11px', color: C.muted, fontWeight: 600, padding: '6px' }}>{text} ₹</th>)}</tr></thead>
            <tbody>
              {GTYPES.map(([t, text]) => (
                <tr key={t}>
                  <td style={{ fontSize: '13px', color: C.ink, padding: '6px', whiteSpace: 'nowrap' }}>{text}</td>
                  {GVIEWS.map(([v]) => (
                    <td key={v} style={{ padding: '6px' }}><input style={{ ...input, padding: '6px 8px' }} type="number" min="0" step="1" value={costs[t][v]} onChange={e => setCosts(c => ({ ...c, [t]: { ...c[t], [v]: e.target.value } }))} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
