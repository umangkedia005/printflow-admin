import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCod, markCodRemitted, payOutCod } from './api'
import { C, SERIF, panel, input, label, button, primary, th, td, empty } from './theme'
import Heading from './Heading'

// COD Remittance: cash-on-delivery money from the courier to the brands.
//  1. With courier: delivered, ProShip hasn't paid us yet. Tick the orders a
//     ProShip remittance covers and record its date + UTR.
//  2. To pay: grouped by brand with its bank details. Transfer the total from
//     the bank, then record the transfer's date + UTR (the brand is emailed).
//  3. All COD orders, for looking things up.
// Returns (RTO) are marked from the Orders tab.

const money = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const STAGE = {
  awaiting_delivery: ['Awaiting delivery', C.wash, C.muted],
  delivered: ['With courier', C.goldWash, C.gold],
  remitted: ['To pay brand', C.blueWash, C.blue],
  paid: ['Paid', C.greenWash, C.green],
  rto: ['RTO', C.redWash, C.red],
}
const VIEWS = [['courier', 'With courier'], ['payout', 'To pay brands'], ['all', 'All COD orders']]

function Stage({ stage }) {
  const [text, bg, fg] = STAGE[stage] || STAGE.awaiting_delivery
  return <span style={{ background: bg, color: fg, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px', whiteSpace: 'nowrap' }}>{text}</span>
}

function Reference({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ width: '160px' }}><span style={label}>DATE</span><input style={input} type="date" value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} /></div>
      <div style={{ flex: '1 1 200px' }}><span style={label}>UTR / REFERENCE</span><input style={input} value={value.utr} maxLength={60} onChange={e => onChange({ ...value, utr: e.target.value })} placeholder="e.g. HDFCN52026112212345" /></div>
    </div>
  )
}

function BrandPayout({ email, brand, rows, onDone }) {
  const [ref, setRef] = useState({ date: today(), utr: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const total = rows.reduce((s, r) => s + Number(r.net), 0)
  const bank = brand?.bank || {}

  async function pay() {
    if (!window.confirm(`Record that you transferred ${money(total)} to ${brand?.name || email}?\n\nThe brand will be emailed with UTR ${ref.utr}.`)) return
    setBusy(true); setMsg(null)
    try {
      await payOutCod(email, rows.map(r => r.order_id), ref.date, ref.utr.trim())
      onDone()
    } catch (e) {
      setMsg(e.message)
      setBusy(false)
    }
  }

  return (
    <div style={{ ...panel, padding: '18px 20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: '20px' }}>{brand?.name || email}</div>
        <div style={{ fontSize: '12px', color: C.muted }}>{email}</div>
        <div style={{ fontSize: '13px', marginTop: '10px', lineHeight: 1.8 }}>
          {rows.map(r => (
            <div key={r.order_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: `1px solid ${C.ruleSoft}` }}>
              <span>{r.order_name} <span style={{ color: C.muted }}>· {r.customer}</span></span>
              <span style={{ whiteSpace: 'nowrap' }}>{money(r.amount)} <span style={{ color: C.muted }}>− {money(r.fee)}</span> = <b>{money(r.net)}</b></span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: '0 1 340px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ background: C.wash, borderRadius: '10px', padding: '12px 14px', fontSize: '13px', lineHeight: 1.7 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: C.muted, letterSpacing: '0.04em' }}>TRANSFER {money(total)} TO</div>
          {bank.account_number ? (
            <>
              <div><b>{bank.account_holder}</b></div>
              <div style={{ fontFamily: 'ui-monospace, monospace' }}>A/c {bank.account_number}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace' }}>IFSC {bank.ifsc}</div>
              <div style={{ color: C.muted }}>{bank.bank_name}</div>
            </>
          ) : <div style={{ color: C.red }}>No bank details yet. Ask the brand to add them in Settings → Bank Account.</div>}
        </div>
        <Reference value={ref} onChange={setRef} />
        <button style={primary} disabled={busy || !bank.account_number || !ref.utr.trim() || !ref.date} onClick={pay}>{busy ? 'Saving…' : `Mark ${money(total)} as paid`}</button>
        {msg && <div style={{ fontSize: '12px', color: C.red }}>{msg}</div>}
      </div>
    </div>
  )
}

export default function CodAdmin() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState('courier')
  const [picked, setPicked] = useState({})
  const [ref, setRef] = useState({ date: today(), utr: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    setError('')
    fetchCod().then(d => { setData(d); setPicked({}) }).catch(e => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  const orders = useMemo(() => data?.orders || [], [data])
  const withCourier = orders.filter(r => r.stage === 'delivered')
  const toPay = orders.filter(r => r.stage === 'remitted')
  const byBrand = useMemo(() => {
    const g = {}
    for (const r of toPay) (g[r.owner || '—'] = g[r.owner || '—'] || []).push(r)
    return Object.entries(g)
  }, [toPay])
  const sum = rows => rows.reduce((s, r) => s + Number(r.amount), 0)
  const chosen = withCourier.filter(r => picked[r.order_id])

  async function recordRemittance() {
    setBusy(true); setNotice('')
    try {
      const res = await markCodRemitted(chosen.map(r => r.order_id), ref.date, ref.utr.trim())
      setNotice(`Recorded ProShip remittance ${ref.utr} for ${res.remitted.length} order${res.remitted.length === 1 ? '' : 's'}. They're now under "To pay brands".`)
      setRef({ date: today(), utr: '' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const search = q.trim().toLowerCase()
  const allRows = orders.filter(r => !search || [r.order_name, r.order_id, r.customer, r.owner, r.awb, r.payout?.utr, r.remittance?.utr].some(v => String(v || '').toLowerCase().includes(search)))

  return (
    <div>
      <Heading eyebrow="Cash on delivery" title="COD Remittance">
        <button style={button} onClick={load}>Refresh</button>
      </Heading>
      <p style={{ color: C.muted, fontSize: '13px', marginTop: '-8px', marginBottom: '16px', maxWidth: '760px', lineHeight: 1.6 }}>
        Book COD orders in the ProShip panel with the amount shown on the order. When ProShip pays you, record it here; then transfer each brand its money (minus the {data ? money(data.cod_fee) : 'COD'} fee per order) and record the UTR. Mark returned parcels as RTO from the Orders tab ({data ? money(data.rto_charge) : 'flat'} charged to the brand's wallet).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {[['Awaiting delivery', orders.filter(r => r.stage === 'awaiting_delivery')], ['With courier', withCourier], ['To pay brands', toPay], ['Paid out', orders.filter(r => r.stage === 'paid')]].map(([t, rows]) => (
          <div key={t} style={{ ...panel, padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: C.muted, letterSpacing: '0.04em' }}>{t.toUpperCase()}</div>
            <div style={{ fontFamily: SERIF, fontSize: '24px', marginTop: '4px' }}>{money(t === 'To pay brands' ? rows.reduce((s, r) => s + Number(r.net), 0) : sum(rows))}</div>
            <div style={{ fontSize: '12px', color: C.muted }}>{rows.length} order{rows.length === 1 ? '' : 's'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {VIEWS.map(([id, text]) => <button key={id} style={view === id ? primary : button} onClick={() => setView(id)}>{text}{id === 'courier' && withCourier.length ? ` ${withCourier.length}` : ''}{id === 'payout' && byBrand.length ? ` ${byBrand.length}` : ''}</button>)}
      </div>

      {error && <div style={{ ...panel, padding: '12px 16px', color: C.red, background: C.redWash, marginBottom: '14px' }}>{error}</div>}
      {notice && <div style={{ ...panel, padding: '12px 16px', color: C.green, background: C.greenWash, marginBottom: '14px' }}>{notice}</div>}
      {!data && !error && <div style={empty}>Loading…</div>}

      {data && view === 'courier' && (
        withCourier.length === 0 ? <div style={{ ...panel, ...empty }}>No delivered COD orders waiting for ProShip.</div> : (
          <>
            <div style={{ ...panel, overflow: 'hidden', marginBottom: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}><input type="checkbox" aria-label="Pick all" checked={chosen.length === withCourier.length} onChange={e => setPicked(Object.fromEntries(withCourier.map(r => [r.order_id, e.target.checked])))} /></th>
                  {['Order', 'Brand', 'Customer', 'AWB', 'Delivered', 'Collected'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {withCourier.map(r => (
                    <tr key={r.order_id} onClick={() => setPicked(p => ({ ...p, [r.order_id]: !p[r.order_id] }))} style={{ cursor: 'pointer', background: picked[r.order_id] ? C.goldWash : undefined }}>
                      <td style={td}><input type="checkbox" readOnly checked={!!picked[r.order_id]} aria-label={`Pick ${r.order_name}`} /></td>
                      <td style={td}>{r.order_name}</td>
                      <td style={{ ...td, fontSize: '12px' }}>{data.brands[r.owner]?.name || r.owner}</td>
                      <td style={td}>{r.customer}<div style={{ fontSize: '11px', color: C.muted }}>{r.city}</div></td>
                      <td style={{ ...td, fontSize: '12px' }}>{r.awb || '—'}</td>
                      <td style={{ ...td, fontSize: '12px' }}>{day(r.delivered_at)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ ...panel, padding: '16px 18px' }}>
              <div style={{ fontSize: '13px', marginBottom: '10px' }}>ProShip paid you for <b>{chosen.length}</b> order{chosen.length === 1 ? '' : 's'} · <b>{money(sum(chosen))}</b></div>
              <Reference value={ref} onChange={setRef} />
              <button style={{ ...primary, marginTop: '12px' }} disabled={busy || !chosen.length || !ref.utr.trim() || !ref.date} onClick={recordRemittance}>{busy ? 'Saving…' : 'Record ProShip remittance'}</button>
            </div>
          </>
        )
      )}

      {data && view === 'payout' && (
        byBrand.length === 0 ? <div style={{ ...panel, ...empty }}>Nothing to pay. Record a ProShip remittance first.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {byBrand.map(([email, rows]) => (
              <BrandPayout key={email} email={email} brand={data.brands[email]} rows={rows}
                onDone={() => { setNotice(`Payout recorded for ${data.brands[email]?.name || email}; they've been emailed.`); load() }} />
            ))}
          </div>
        )
      )}

      {data && view === 'all' && (
        <>
          <input style={{ ...input, borderRadius: '99px', padding: '10px 18px', marginBottom: '12px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search order, customer, brand, AWB or UTR" />
          <div style={{ ...panel, overflowX: 'auto' }}>
            {allRows.length === 0 ? <div style={empty}>{orders.length ? 'Nothing matches.' : 'No COD orders yet.'}</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '960px' }}>
                <thead><tr>{['Order', 'Brand', 'Customer', 'Collect', 'Fee', 'Brand gets', 'Stage', 'ProShip paid', 'Paid to brand'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {allRows.map(r => (
                    <tr key={r.order_id}>
                      <td style={td}>{r.order_name}<div style={{ fontSize: '11px', color: C.muted }}>{day(r.created_at)}</div></td>
                      <td style={{ ...td, fontSize: '12px' }}>{data.brands[r.owner]?.name || r.owner || '—'}</td>
                      <td style={td}>{r.customer}<div style={{ fontSize: '11px', color: C.muted }}>{r.city}</div></td>
                      <td style={{ ...td, fontWeight: 600 }}>{money(r.amount)}{Number(r.prepaid) > 0 && <div style={{ fontSize: '11px', color: C.muted, fontWeight: 400 }}>+{money(r.prepaid)} online</div>}</td>
                      <td style={{ ...td, color: C.muted }}>{money(r.fee)}</td>
                      <td style={td}>{money(r.net)}</td>
                      <td style={td}><Stage stage={r.stage} /></td>
                      <td style={{ ...td, fontSize: '12px' }}>{r.remittance ? <>{day(r.remittance.date)}<div style={{ color: C.muted }}>{r.remittance.utr}</div></> : '—'}</td>
                      <td style={{ ...td, fontSize: '12px' }}>{r.payout ? <>{day(r.payout.date)}<div style={{ color: C.muted }}>{r.payout.utr}</div></> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
