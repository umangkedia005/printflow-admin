import { useState } from 'react'
import { createPortal } from 'react-dom'
import { C, SERIF, SANS, button } from './theme'

const inch = n => `${Number(n).toFixed(1)}″`
const pct = n => `${n * 100}%`

// Images are fetched fresh (not from the page's cache) so the canvas may read
// them: the artwork bucket allows this site, but a cached copy loaded without
// CORS would block the export.
async function loadImage(url) {
  const res = await fetch(url, { mode: 'cors', cache: 'no-store' })
  if (!res.ok) throw new Error('Could not load an image for the mockup.')
  const blobUrl = URL.createObjectURL(await res.blob())
  try {
    const img = new Image()
    img.src = blobUrl
    await img.decode()
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
  }
}

// One PNG of the finished side: the garment photo at full size with the
// artwork drawn where it prints, cut to the print area (same as the preview).
async function downloadMockup(p, filename) {
  const [photo, art] = await Promise.all([loadImage(p.mockup_photo_url), loadImage(p.file_url)])
  const size = Math.max(photo.naturalWidth, photo.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(photo, (size - photo.naturalWidth) / 2, (size - photo.naturalHeight) / 2)
  const box = p.mockup_box
  const bx = Number(box.x) * size, by = Number(box.y) * size, bw = Number(box.w) * size, bh = Number(box.h) * size
  const aw = Number(p.area_w_in), ah = Number(p.area_h_in)
  const x = Number(p.x_in ?? p.from_left_in), y = Number(p.y_in ?? p.from_top_in)
  ctx.save()
  ctx.beginPath()
  ctx.rect(bx, by, bw, bh)
  ctx.clip()
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(art, bx + (x / aw) * bw, by + (y / ah) * bh, (Number(p.artwork_w_in) / aw) * bw, (Number(p.artwork_h_in) / ah) * bh)
  ctx.restore()
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function MockupDownload({ p, filename }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function go() {
    setBusy(true)
    setError('')
    try {
      await downloadMockup(p, filename)
    } catch (err) {
      setError(err.message || 'Could not make the mockup.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button onClick={go} disabled={busy} style={{ background: 'none', border: 'none', padding: 0, color: C.blue, textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: SANS }}>{busy ? 'Making mockup…' : 'Download mockup'}</button>
      {error && <span style={{ color: C.red }}>{error}</span>}
    </>
  )
}

// Where the parcel goes, for booking the courier (e.g. in ProShip).
function ShipTo({ order }) {
  const [copied, setCopied] = useState(false)
  const raw = order.raw || {}
  const a = raw.shipping_address || {}
  const method = order.breakdown?.shipping_method || raw.shipping_lines?.[0]?.title
  const lines = [
    a.name,
    a.address1,
    a.address2,
    [a.city, a.province, a.zip].filter(Boolean).join(', '),
    a.country && a.country !== 'IN' ? a.country : null,
  ].filter(Boolean)
  const phone = a.phone || raw.phone
  if (!lines.length) {
    return <div style={{ fontSize: '12px', color: C.muted, padding: '14px 0' }}>{order.redacted_at ? 'Address removed at the customer\'s request.' : 'No shipping address on this order.'}</div>
  }
  async function copy() {
    await navigator.clipboard.writeText([...lines, phone && `Phone: ${phone}`].filter(Boolean).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '16px 18px', background: C.wash, borderRadius: '10px', marginTop: '16px' }}>
      <div style={{ fontSize: '13px', color: C.inkSoft, lineHeight: 1.6 }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gold, marginBottom: '4px' }}>Ship to</div>
        {lines.map((l, i) => <div key={i} style={i === 0 ? { fontWeight: 600, color: C.ink } : undefined}>{l}</div>)}
        {phone && <div>Phone: {phone}</div>}
        {order.email && <div style={{ color: C.muted }}>{order.email}</div>}
      </div>
      <div style={{ textAlign: 'right', fontSize: '12px', color: C.inkSoft, lineHeight: 1.7, flexShrink: 0 }}>
        {method && <div><span style={{ color: C.muted }}>Shipping</span> <strong style={{ color: C.ink, textTransform: 'capitalize' }}>{method}</strong></div>}
        {order.reference && <div><span style={{ color: C.muted }}>Ref</span> {order.reference}</div>}
        <button onClick={copy} style={{ ...button, padding: '5px 12px', fontSize: '12px', marginTop: '6px' }}>{copied ? 'Copied ✓' : 'Copy address'}</button>
      </div>
    </div>
  )
}

// The finished look: the garment photo for this side in the ordered colour,
// with the artwork placed where it prints and cut to the print area.
function Mockup({ p }) {
  const box = p.mockup_box || {}
  const aw = Number(p.area_w_in), ah = Number(p.area_h_in)
  const x = Number(p.x_in ?? p.from_left_in), y = Number(p.y_in ?? p.from_top_in)
  return (
    <div style={{ position: 'relative', width: '170px', aspectRatio: '1 / 1', flexShrink: 0, borderRadius: '10px', overflow: 'hidden', background: C.card, border: `1px solid ${C.rule}` }}>
      <img src={p.mockup_photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', maxWidth: 'none' }} />
      <div style={{ position: 'absolute', left: pct(Number(box.x)), top: pct(Number(box.y)), width: pct(Number(box.w)), height: pct(Number(box.h)), outline: '1px dashed rgba(43,91,168,0.55)', overflow: 'hidden' }}>
        <img src={p.file_url} alt="" style={{ position: 'absolute', maxWidth: 'none', left: pct(x / aw), top: pct(y / ah), width: pct(Number(p.artwork_w_in) / aw), height: pct(Number(p.artwork_h_in) / ah) }} />
      </div>
    </div>
  )
}

// Everything the printer needs for one order: per item, which file goes on
// which side, how big, and where, measured from the print area's top-left.
export default function PrintSheet({ order, onClose }) {
  const items = order.items || []
  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,24,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: SANS }}>
      <div style={{ background: C.card, borderRadius: '16px', width: '100%', maxWidth: '760px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '22px 26px', borderBottom: `1px solid ${C.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: '22px', color: C.ink }}>Print details · {(order.order_name || order.order_id).replace('#', '')}</div>
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>Positions are measured from the top-left corner of each print area.</div>
          </div>
          <button onClick={onClose} style={{ ...button, padding: '6px 12px' }}>Close</button>
        </div>
        <div style={{ padding: '8px 26px 24px' }}>
          <ShipTo order={order} />
          {items.map((item, i) => {
            const prints = item.prints || []
            return (
              <div key={i} style={{ padding: '18px 0', borderBottom: i < items.length - 1 ? `1px solid ${C.ruleSoft}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: C.ink }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{item.variant_title}{item.sku ? ` · SKU ${item.sku}` : ''}</div>
                    {item.customer_garment && <div style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', fontWeight: 600, color: C.gold, background: C.goldWash, padding: '2px 8px', borderRadius: '99px' }}>Customer's garment: print on the shirts they sent</div>}
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: '18px', color: C.ink, whiteSpace: 'nowrap' }}>× {item.quantity}</div>
                </div>

                {prints.length > 0 ? prints.map(p => (
                  <div key={p.area_id} style={{ display: 'flex', gap: '14px', marginTop: '12px', background: C.wash, borderRadius: '10px', padding: '12px' }}>
                    {p.mockup_photo_url && p.mockup_box ? <Mockup p={p} /> : (
                      <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ width: '64px', height: '64px', flexShrink: 0, borderRadius: '8px', background: C.card, border: `1px solid ${C.rule}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={p.file_url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                      </a>
                    )}
                    <div style={{ fontSize: '12px', color: C.inkSoft, lineHeight: 1.7, flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gold }}>{p.area}</div>
                      <div><strong style={{ color: C.ink }}>Print size {inch(p.printed_w_in)} × {inch(p.printed_h_in)}</strong> · {inch(p.from_left_in)} from left, {inch(p.from_top_in)} from top of the {inch(p.area_w_in)} × {inch(p.area_h_in)} area</div>
                      <div style={{ color: C.muted }}>File {p.px_w} × {p.px_h}px · {Math.round(p.px_w / p.artwork_w_in)} DPI at this size</div>
                      {p.clipped && <div style={{ color: C.red }}>Artwork runs past the print area: print only the part inside it (artwork is {inch(p.artwork_w_in)} × {inch(p.artwork_h_in)}).</div>}
                      <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                        <a href={p.download_url || p.file_url} style={{ color: C.blue }}>Download file</a>
                        {p.mockup_photo_url && p.mockup_box && <MockupDownload p={p} filename={`${order.order_id}_${p.area_id}_mockup.png`} />}
                        <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>View</a>
                      </div>
                    </div>
                  </div>
                )) : item.print_file_url ? (
                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '10px' }}>
                    <a href={item.print_file_url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>Download print file</a>
                    {order.source === 'manual' && ' · placed before print details were saved; check the design with the customer.'}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: order.source === 'manual' ? C.muted : C.red, marginTop: '10px' }}>{order.source === 'manual' ? 'Blank, no printing.' : 'No print file set for this product.'}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
