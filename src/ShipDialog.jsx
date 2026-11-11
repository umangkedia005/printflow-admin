import { useState } from 'react'
import { createPortal } from 'react-dom'
import { C, SERIF, SANS, input, label, button, primary } from './theme'

// Asked when an order is marked shipped. Everything is optional; whatever is
// filled in goes into the merchant's "shipped" email and their order page.
export default function ShipDialog({ order, onCancel, onConfirm, saving, error }) {
  const [courier, setCourier] = useState('')
  const [number, setNumber] = useState('')
  const [url, setUrl] = useState('')
  const name = (order.order_name || order.order_id).replace('#', '')
  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onCancel() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,24,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: SANS }}>
      <form onSubmit={e => { e.preventDefault(); onConfirm({ courier, number, url }) }} style={{ background: C.card, borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px 26px', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ fontFamily: SERIF, fontSize: '22px', color: C.ink }}>Mark {name} shipped</div>
        <div style={{ fontSize: '12px', color: C.muted, margin: '4px 0 18px' }}>The merchant gets an email with these details. All optional.</div>
        <label style={label}>COURIER</label>
        <input style={{ ...input, marginBottom: '12px' }} value={courier} onChange={e => setCourier(e.target.value)} placeholder="Delhivery, Blue Dart, India Post…" autoFocus />
        <label style={label}>TRACKING NUMBER</label>
        <input style={{ ...input, marginBottom: '12px' }} value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 1234567890" />
        <label style={label}>TRACKING LINK</label>
        <input style={input} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
        {error && <div style={{ color: C.red, fontSize: '12px', marginTop: '10px' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" onClick={onCancel} style={button}>Cancel</button>
          <button type="submit" disabled={saving} style={primary}>{saving ? 'Saving…' : 'Mark shipped'}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
