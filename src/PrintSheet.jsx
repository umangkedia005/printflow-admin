import { createPortal } from 'react-dom'
import { C, SERIF, SANS, button } from './theme'

const inch = n => `${Number(n).toFixed(1)}″`

// Everything the printer needs for one order: per item, which file goes on
// which side, how big, and where, measured from the print area's top-left.
export default function PrintSheet({ order, onClose }) {
  const items = order.items || []
  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,24,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: SANS }}>
      <div style={{ background: C.card, borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '22px 26px', borderBottom: `1px solid ${C.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: '22px', color: C.ink }}>Print details · {(order.order_name || order.order_id).replace('#', '')}</div>
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>Positions are measured from the top-left corner of each print area.</div>
          </div>
          <button onClick={onClose} style={{ ...button, padding: '6px 12px' }}>Close</button>
        </div>
        <div style={{ padding: '8px 26px 24px' }}>
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
                    <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ width: '64px', height: '64px', flexShrink: 0, borderRadius: '8px', background: C.card, border: `1px solid ${C.rule}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={p.file_url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                    </a>
                    <div style={{ fontSize: '12px', color: C.inkSoft, lineHeight: 1.7, flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gold }}>{p.area}</div>
                      <div><strong style={{ color: C.ink }}>Print size {inch(p.printed_w_in)} × {inch(p.printed_h_in)}</strong> · {inch(p.from_left_in)} from left, {inch(p.from_top_in)} from top of the {inch(p.area_w_in)} × {inch(p.area_h_in)} area</div>
                      <div style={{ color: C.muted }}>File {p.px_w} × {p.px_h}px · {Math.round(p.px_w / p.artwork_w_in)} DPI at this size</div>
                      {p.clipped && <div style={{ color: C.red }}>Artwork runs past the print area: print only the part inside it (artwork is {inch(p.artwork_w_in)} × {inch(p.artwork_h_in)}).</div>}
                      <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>Download file</a>
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
