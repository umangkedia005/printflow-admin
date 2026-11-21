import { useCallback, useEffect, useState } from 'react'
import { fetchBrandingAdmin, saveBrandingCatalog, reviewBrandingOrder, setBrandingStock, openInvoice } from './api'
import { C, SERIF, panel, input, label, button, primary, outline } from './theme'
import Heading from './Heading'

// Branding: brands buy hang tags and custom courier bags in bulk.
// 1. Orders: check artwork → In production (or reject: money goes back) → Ready
//    (pieces are added to the brand's stock).
// 2. Prices: sizes and quantity tiers brands can pick from.
// 3. Brand stock: pieces left per brand; update as they're used.
const STATUS = {
  review: ['Check artwork', C.goldWash, C.gold],
  production: ['In production', C.blueWash, C.blue],
  ready: ['Ready · in stock', C.greenWash, C.green],
  rejected: ['Rejected · refunded', C.redWash, C.red],
}
const PRODUCTS = [['hang_tag', 'Hang tags'], ['poly_bag', 'Custom courier bags'], ['thank_you_card', 'Thank you cards']]
const rupees = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function OrderCard({ o, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [err, setErr] = useState('')
  const [label_, bg, fg] = STATUS[o.status] || STATUS.review
  async function move(status) {
    setBusy(true); setErr('')
    try { onChanged((await reviewBrandingOrder(o.email, o.order_id, status, reason)).order) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div style={{ ...panel, padding: '16px 18px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {Object.entries(o.artwork_urls || {}).map(([side, url]) => (
          <a key={side} href={url} target="_blank" rel="noopener noreferrer" title={`Open ${side} artwork`} style={{ display: 'block', width: '96px', textAlign: 'center', fontSize: '10px', color: C.muted, textDecoration: 'none' }}>
            <div style={{ width: '96px', height: '96px', borderRadius: '10px', border: `1px solid ${C.rule}`, background: `${C.wash} url("${url}") center/contain no-repeat` }} />
            {side}
          </a>
        ))}
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: '13px', color: C.inkSoft, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SERIF, fontSize: '17px', color: C.ink }}>{o.product_name} · {o.size_label} × {Number(o.qty).toLocaleString('en-IN')}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: '99px', background: bg, color: fg }}>{label_}</span>
        </div>
        <div>{o.email} · {o.order_id} · paid {rupees(o.total ?? o.price)}{o.gst != null ? ` (incl. GST ${rupees(o.gst)})` : ''} · {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        {o.design?.mode === 'template'
          ? <div style={{ color: C.blue }}>Made from template: {o.design.style} style · “{o.design.brand_name}”{o.design.headline ? ` · “${o.design.headline}”` : ''}{o.design.tagline ? ` · “${o.design.tagline}”` : ''}{o.design.handle ? ` · ${o.design.handle}` : ''}{o.design.has_logo ? ' · with logo' : ''}</div>
          : <div style={{ color: C.muted }}>Brand's own artwork</div>}
        {o.notes && <div style={{ color: C.muted }}>Notes: {o.notes}</div>}
        {o.reason && <div style={{ color: C.red }}>Reason: {o.reason}</div>}
        {(o.status === 'production' || o.status === 'ready') && <button onClick={() => openInvoice('branding', o.order_id).catch(e => setErr(e.message))} style={{ background: 'none', border: 'none', padding: 0, color: C.blue, textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}>Download invoice{o.invoice?.number ? ` (${o.invoice.number})` : ''}</button>}
        {err && <div style={{ color: C.red }}>{err}</div>}
        {rejecting && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input style={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="What needs changing (the brand sees this)" maxLength={300} />
            <button style={{ ...primary, background: C.red, borderColor: C.red }} disabled={busy || !reason.trim()} onClick={() => move('rejected')}>Reject & refund</button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
        {o.status === 'review' && <>
          <button style={primary} disabled={busy} onClick={() => move('production')}>Approve · start production</button>
          <button style={outline} disabled={busy} onClick={() => setRejecting(r => !r)}>{rejecting ? 'Cancel' : 'Reject'}</button>
        </>}
        {o.status === 'production' && <button style={primary} disabled={busy} onClick={() => move('ready')}>Mark ready · add {Number(o.qty).toLocaleString('en-IN')} to stock</button>}
      </div>
    </div>
  )
}

function Prices({ catalog, onSaved }) {
  const start = () => Object.fromEntries(PRODUCTS.map(([pid]) => [pid, {
    description: catalog[pid]?.description || '', lead_min: catalog[pid]?.lead_min || 7, lead_max: catalog[pid]?.lead_max || catalog[pid]?.lead_days || 10,
    sizes: (catalog[pid]?.sizes || []).map(s => ({ label: s.label, tiers: s.tiers.map(t => ({ qty: String(t.qty), price: String(t.price) })) })),
  }]))
  const [form, setForm] = useState(start)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const set = (pid, fn) => { setForm(f => ({ ...f, [pid]: fn(structuredClone(f[pid])) })); setMsg(null) }

  async function save() {
    setBusy(true); setMsg(null)
    try { onSaved((await saveBrandingCatalog(form)).catalog); setMsg({ ok: true, text: 'Saved' }) } catch (e) { setMsg({ ok: false, text: e.message }) } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {PRODUCTS.map(([pid, name]) => (
        <div key={pid} style={{ ...panel, padding: '18px 22px' }}>
          <div style={{ fontFamily: SERIF, fontSize: '19px', color: C.ink, marginBottom: '10px' }}>{name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', gap: '10px', marginBottom: '12px' }}>
            <div><span style={label}>DESCRIPTION (shown to brands)</span><input style={input} value={form[pid].description} maxLength={300} onChange={e => set(pid, p => ({ ...p, description: e.target.value }))} placeholder={{ hang_tag: 'e.g. 350 GSM matte card, printed both sides, with string', poly_bag: 'e.g. 60 micron, tamper-proof seal, printed one side', thank_you_card: 'e.g. 350 GSM card, printed one side' }[pid]} /></div>
            <div><span style={label}>MADE IN · FROM (DAYS)</span><input style={input} type="number" min="1" max="90" value={form[pid].lead_min} onChange={e => set(pid, p => ({ ...p, lead_min: e.target.value }))} /></div>
            <div><span style={label}>TO (DAYS)</span><input style={input} type="number" min="1" max="90" value={form[pid].lead_max} onChange={e => set(pid, p => ({ ...p, lead_max: e.target.value }))} /></div>
          </div>
          {form[pid].sizes.map((s, si) => (
            <div key={si} style={{ border: `1px solid ${C.ruleSoft}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}><span style={label}>SIZE</span><input style={input} value={s.label} onChange={e => set(pid, p => { p.sizes[si].label = e.target.value; return p })} placeholder={{ hang_tag: '2 x 3.5 in', poly_bag: '10 x 12 in', thank_you_card: 'A6 (4.1 x 5.8 in)' }[pid]} /></div>
                <button style={button} onClick={() => set(pid, p => { p.sizes.splice(si, 1); return p })}>Remove size</button>
              </div>
              {s.tiers.map((t, ti) => (
                <div key={ti} style={{ display: 'grid', gridTemplateColumns: '140px 160px auto 1fr', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <input style={input} type="number" min="1" value={t.qty} placeholder="Quantity" onChange={e => set(pid, p => { p.sizes[si].tiers[ti].qty = e.target.value; return p })} />
                  <input style={input} type="number" min="1" value={t.price} placeholder="Total ₹ (plus GST)" onChange={e => set(pid, p => { p.sizes[si].tiers[ti].price = e.target.value; return p })} />
                  <button style={{ ...button, padding: '6px 12px' }} onClick={() => set(pid, p => { p.sizes[si].tiers.splice(ti, 1); return p })}>✕</button>
                  <span style={{ fontSize: '12px', color: C.muted }}>{Number(t.qty) > 0 && Number(t.price) > 0 ? `${rupees(Number(t.price) / Number(t.qty))} each + GST` : ''}</span>
                </div>
              ))}
              <button style={{ ...button, padding: '6px 12px', fontSize: '12px' }} onClick={() => set(pid, p => { p.sizes[si].tiers.push({ qty: '', price: '' }); return p })}>+ Quantity tier</button>
            </div>
          ))}
          <button style={outline} onClick={() => set(pid, p => { p.sizes.push({ label: '', tiers: [{ qty: '500', price: '' }] }); return p })}>+ Add size</button>
          {!form[pid].sizes.length && <span style={{ fontSize: '12px', color: C.muted, marginLeft: '10px' }}>No sizes: brands see "Prices coming soon".</span>}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button style={primary} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save prices'}</button>
        {msg && <span style={{ fontSize: '13px', color: msg.ok ? C.green : C.red }}>{msg.ok ? '✓ ' : ''}{msg.text}</span>}
      </div>
    </div>
  )
}

function StockRow({ row, onSaved }) {
  const [vals, setVals] = useState(Object.fromEntries(PRODUCTS.map(([pid]) => [pid, String(row[pid]?.left ?? 0)])))
  const [msg, setMsg] = useState('')
  async function save(pid) {
    setMsg('')
    try { onSaved(await setBrandingStock(row.email, pid, Number(vals[pid]))); setMsg('✓') } catch (e) { setMsg(e.message) }
  }
  return (
    <tr style={{ borderTop: `1px solid ${C.ruleSoft}` }}>
      <td style={{ padding: '10px', fontSize: '13px' }}>{row.email}</td>
      {PRODUCTS.map(([pid]) => (
        <td key={pid} style={{ padding: '8px 10px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input style={{ ...input, width: '100px' }} type="number" min="0" value={vals[pid]} onChange={e => setVals(v => ({ ...v, [pid]: e.target.value }))} />
            {vals[pid] !== String(row[pid]?.left ?? 0) && <button style={{ ...button, padding: '6px 10px', fontSize: '12px' }} onClick={() => save(pid)}>Save</button>}
            <span style={{ fontSize: '11px', color: row[pid]?.use_on_orders ? C.green : C.muted }}>{row[pid]?.use_on_orders ? 'used on orders' : 'off'}</span>
          </div>
        </td>
      ))}
      <td style={{ padding: '10px', fontSize: '12px', color: msg === '✓' ? C.green : C.red }}>{msg}</td>
    </tr>
  )
}

export default function BrandingAdmin() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('orders')
  const load = useCallback(() => { fetchBrandingAdmin().then(setData).catch(e => setError(e.message)) }, [])
  useEffect(() => { load() }, [load])

  const onOrder = o => setData(d => ({ ...d, orders: d.orders.map(x => (x.order_id === o.order_id ? o : x)) }))
  const waiting = (data?.orders || []).filter(o => o.status === 'review').length

  return (
    <div>
      <Heading eyebrow="Hang tags, courier bags & thank you cards" title="Branding">
        <button style={button} onClick={load}>Refresh</button>
      </Heading>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[['orders', `Orders${waiting ? ` (${waiting} to check)` : ''}`], ['prices', 'Prices'], ['stock', 'Brand stock']].map(([id, text]) => (
          <button key={id} style={tab === id ? primary : button} onClick={() => setTab(id)}>{text}</button>
        ))}
      </div>
      {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 14px', borderRadius: '10px' }}>{error}</div>}
      {!data && !error && <div style={{ color: C.muted, fontSize: '13px' }}>Loading…</div>}
      {data && tab === 'orders' && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {data.orders.length ? data.orders.map(o => <OrderCard key={o.order_id} o={o} onChanged={onOrder} />) : <div style={{ color: C.muted, fontSize: '13px' }}>No branding orders yet.</div>}
        </div>
      )}
      {data && tab === 'prices' && <Prices catalog={data.catalog} onSaved={catalog => setData(d => ({ ...d, catalog }))} />}
      {data && tab === 'stock' && (
        <div style={{ ...panel, padding: '14px 18px', overflowX: 'auto' }}>
          <p style={{ fontSize: '12.5px', color: C.inkSoft, marginTop: 0 }}>Pieces each brand has left with you. Ready orders add to this; update it as you use them. At 0, "use on orders" switches off.</p>
          {data.stock.length ? (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['Brand', 'Hang tags left', 'Courier bags left', 'Thank you cards left', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '11px', color: C.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>{data.stock.map(r => <StockRow key={r.email} row={r} onSaved={res => setData(d => ({ ...d, stock: d.stock.map(x => (x.email === res.email ? res : x)) }))} />)}</tbody>
            </table>
          ) : <div style={{ color: C.muted, fontSize: '13px' }}>No brand has branding stock yet.</div>}
        </div>
      )}
    </div>
  )
}
