import { useEffect, useRef, useState } from 'react'
import { fetchBlanks, saveBlank, uploadBlankPhoto } from './api'

const card = { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
const input = { padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' }
const label = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '4px' }
const button = { background: '#F3F4F6', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }
const primary = { ...button, background: '#0A0A0A', color: '#fff' }

const NEW_BLANK = {
  blank_id: '', name: '', category: '', description: '', fabric: '', gsm: 180, fit: 'Regular',
  mockup: 'tee', sort_order: 99, active: false,
  colors: [{ name: 'White', hex: '#FFFFFF' }],
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  variants: [],
  print_areas: [{ id: 'front', label: 'Front', width_in: 12, height_in: 16, min_dpi: 150, mockup_box: { x: 0.33, y: 0.25, w: 0.34 } }],
  size_chart: { unit: 'in', columns: ['Chest', 'Length'], rows: {} },
}

const variantKey = (color, size) => `${color}|${size}`
const colorCode = name => name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CLR'
const pct = n => Math.round(Number(n) * 1000) / 10

// Every color × size needs exactly one variant; keep what was typed and add
// blank rows for new combinations.
function syncVariants(form) {
  const existing = new Map(form.variants.map(v => [variantKey(v.color, v.size), v]))
  const variants = form.colors.flatMap(c => form.sizes.map(size =>
    existing.get(variantKey(c.name, size)) || { sku: '', color: c.name, size, base_cost: '', in_stock: true }))
  return { ...form, variants }
}

function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ url, w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not read this image'))
    img.src = url
  })
}

function Section({ title, hint, children, action }) {
  return (
    <div style={{ ...card, padding: '20px 24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{title}</div>
          {hint && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{hint}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// The product photo with every print area drawn on it; the selected area can
// be dragged. Positions are fractions of the (square) photo.
function PrintAreaCanvas({ photoUrl, areas, selected, onMove }) {
  const ref = useRef(null)
  const drag = useRef(null)

  function down(e, i) {
    if (i !== selected) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, from: areas[i].mockup_box, size: ref.current.getBoundingClientRect().width }
  }
  function move(e) {
    const d = drag.current
    if (!d) return
    const a = areas[selected]
    const h = d.from.w * a.height_in / a.width_in
    const clamp = (v, max) => Math.min(Math.max(v, 0), max)
    onMove({
      x: Math.round(clamp(d.from.x + (e.clientX - d.x) / d.size, 1 - d.from.w) * 1000) / 1000,
      y: Math.round(clamp(d.from.y + (e.clientY - d.y) / d.size, 1 - h) * 1000) / 1000,
    })
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: photoUrl ? '#fff' : '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
      {photoUrl
        ? <img src={photoUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' }} />
        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No photo for this color: the dashboard shows a drawing instead.</div>}
      {areas.map((a, i) => {
        const b = a.mockup_box
        const h = b.w * a.height_in / a.width_in
        const on = i === selected
        return (
          <div key={i}>
            {on && a.view && (
              <div style={{ position: 'absolute', left: `${a.view.x * 100}%`, top: `${a.view.y * 100}%`, width: `${a.view.w * 100}%`, height: `${a.view.w * 100}%`, border: '1.5px dashed #F59E0B', pointerEvents: 'none' }} />
            )}
            <div
              onPointerDown={e => down(e, i)} onPointerMove={move} onPointerUp={() => { drag.current = null }}
              style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${h * 100}%`, border: `2px ${on ? 'solid' : 'dashed'} ${on ? '#2563EB' : 'rgba(37,99,235,0.45)'}`, background: on ? 'rgba(37,99,235,0.12)' : 'transparent', cursor: on ? 'move' : 'default', touchAction: 'none', fontSize: '10px', fontWeight: 700, color: '#1D4ED8', padding: '2px 4px', boxSizing: 'border-box', overflow: 'hidden' }}>
              {a.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BlankEditor({ initial, isNew, onSaved, onCancel }) {
  const [form, setForm] = useState(() => syncVariants(JSON.parse(JSON.stringify(initial))))
  const [sizesText, setSizesText] = useState(initial.sizes.join(', '))
  const [selectedArea, setSelectedArea] = useState(0)
  const [previewColor, setPreviewColor] = useState(0)
  const [costBySize, setCostBySize] = useState({})
  const [skuPrefix, setSkuPrefix] = useState(() => (initial.variants[0]?.sku.split('-').slice(0, 2).join('-')) || 'NLS-XX')
  const [uploading, setUploading] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const update = patch => setForm(f => syncVariants({ ...f, ...patch }))
  const setColor = (i, patch) => setForm(f => {
    const old = f.colors[i]
    const colors = f.colors.map((c, j) => (j === i ? { ...c, ...patch } : c))
    // Renaming a color carries its variants along.
    const variants = patch.name !== undefined ? f.variants.map(v => (v.color === old.name ? { ...v, color: patch.name } : v)) : f.variants
    return syncVariants({ ...f, colors, variants })
  })
  const setVariant = (color, size, patch) => setForm(f => ({ ...f, variants: f.variants.map(v => (v.color === color && v.size === size ? { ...v, ...patch } : v)) }))
  const setArea = (i, patch) => setForm(f => ({ ...f, print_areas: f.print_areas.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))

  function applySizes(text) {
    setSizesText(text)
    update({ sizes: [...new Set(text.split(',').map(s => s.trim()).filter(Boolean))] })
  }

  async function handlePhoto(i, e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!form.blank_id) return setError('Set the product ID before uploading photos.')
    try {
      const { url, w, h } = await readImageSize(file)
      if (Math.abs(w - h) / Math.max(w, h) > 0.02) return setError(`Photos must be square (this one is ${w}×${h}).`)
      setUploading(i)
      const key = await uploadBlankPhoto(form.blank_id, file)
      setColor(i, { image_key: key, image_url: url })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(null)
    }
  }

  function applyCosts() {
    setForm(f => ({ ...f, variants: f.variants.map(v => (costBySize[v.size] ? { ...v, base_cost: Number(costBySize[v.size]) } : v)) }))
  }
  function generateSkus() {
    const prefix = skuPrefix.trim().toUpperCase()
    setForm(f => ({ ...f, variants: f.variants.map(v => ({ ...v, sku: `${prefix}-${colorCode(v.color)}-${v.size}`.replace(/[^A-Z0-9_-]/gi, '') })) }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const saved = await saveBlank(form)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const area = form.print_areas[selectedArea]
  const chart = form.size_chart || { unit: 'in', columns: [], rows: {} }
  const photoCount = form.colors.filter(c => c.image_key).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onCancel} style={button}>← Back</button>
          <span style={{ fontWeight: 800, fontSize: '18px' }}>{isNew ? 'New product' : form.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <input type="checkbox" checked={form.active} onChange={e => update({ active: e.target.checked })} /> Visible to merchants
          </label>
          <button onClick={handleSave} disabled={saving} style={{ ...primary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save product'}</button>
        </div>
      </div>
      {error && <div style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', background: '#FEF2F2', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}

      <Section title="Basics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          <div><span style={label}>Product ID</span><input style={{ ...input, background: isNew ? '#fff' : '#F9FAFB' }} value={form.blank_id} disabled={!isNew} placeholder="e.g. classic-polo" onChange={e => update({ blank_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></div>
          <div><span style={label}>Name</span><input style={input} value={form.name} onChange={e => update({ name: e.target.value })} /></div>
          <div><span style={label}>Category</span><input style={input} value={form.category} onChange={e => update({ category: e.target.value })} /></div>
          <div><span style={label}>Fabric</span><input style={input} value={form.fabric} onChange={e => update({ fabric: e.target.value })} /></div>
          <div><span style={label}>GSM</span><input style={input} type="number" value={form.gsm} onChange={e => update({ gsm: e.target.value })} /></div>
          <div><span style={label}>Fit</span><input style={input} value={form.fit} onChange={e => update({ fit: e.target.value })} /></div>
          <div><span style={label}>Order in catalogue</span><input style={input} type="number" value={form.sort_order} onChange={e => update({ sort_order: e.target.value })} /></div>
          <div><span style={label}>Drawing when no photo</span>
            <select style={input} value={form.mockup} onChange={e => update({ mockup: e.target.value })}><option value="tee">T-shirt</option><option value="hoodie">Hoodie</option></select>
          </div>
        </div>
        <div style={{ marginTop: '12px' }}><span style={label}>Description</span><textarea style={{ ...input, resize: 'vertical' }} rows={2} value={form.description} onChange={e => update({ description: e.target.value })} /></div>
      </Section>

      <Section title="Colors and photos" hint="Square photos, one per color. A photo can show front and back side by side."
        action={<button style={button} onClick={() => update({ colors: [...form.colors, { name: `Color ${form.colors.length + 1}`, hex: '#CCCCCC' }] })}>+ Add color</button>}>
        {photoCount > 0 && photoCount < form.colors.length && (
          <div style={{ fontSize: '12px', color: '#B45309', background: '#FFFBEB', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>Some colors have no photo. Print positions are set on the photos, so give every color one.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {form.colors.map((c, i) => (
            <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px' }}>
              <div style={{ aspectRatio: '1 / 1', background: c.image_url ? '#fff' : c.hex, borderRadius: '8px', overflow: 'hidden', marginBottom: '10px', border: '1px solid #F3F4F6' }}>
                {c.image_url && <img src={c.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input style={input} value={c.name} onChange={e => setColor(i, { name: e.target.value })} />
                <input type="color" value={c.hex} onChange={e => setColor(i, { hex: e.target.value.toUpperCase() })} style={{ width: '40px', height: '34px', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '2px', flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <label style={{ ...button, padding: '6px 10px', fontSize: '12px' }}>
                  {uploading === i ? 'Uploading…' : c.image_key ? 'Replace photo' : 'Upload photo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => handlePhoto(i, e)} />
                </label>
                <button style={{ ...button, padding: '6px 10px', fontSize: '12px' }} onClick={() => setPreviewColor(i)}>Use for print areas</button>
                {form.colors.length > 1 && <button style={{ ...button, padding: '6px 10px', fontSize: '12px', color: '#DC2626' }} onClick={() => { update({ colors: form.colors.filter((_, j) => j !== i) }); setPreviewColor(0) }}>Remove</button>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Sizes, costs and SKUs" hint="The SKU is what the factory receives with each order, so it must match theirs.">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div style={{ flex: '1 1 260px' }}><span style={label}>Sizes (comma separated)</span><input style={input} value={sizesText} onChange={e => applySizes(e.target.value)} /></div>
          <div style={{ flex: '0 1 200px' }}><span style={label}>SKU prefix</span>
            <div style={{ display: 'flex', gap: '6px' }}><input style={input} value={skuPrefix} onChange={e => setSkuPrefix(e.target.value)} /><button style={button} onClick={generateSkus}>Fill SKUs</button></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '14px' }}>
          {form.sizes.map(s => (
            <div key={s} style={{ width: '80px' }}><span style={label}>{s} cost ₹</span><input style={input} type="number" value={costBySize[s] ?? ''} onChange={e => setCostBySize(c => ({ ...c, [s]: e.target.value }))} /></div>
          ))}
          <button style={button} onClick={applyCosts}>Apply to all colors</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: '#F9FAFB' }}>{['Color', 'Size', 'Factory SKU', 'Base cost ₹', 'In stock'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {form.variants.map(v => (
                <tr key={variantKey(v.color, v.size)} style={{ borderTop: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '6px 10px' }}>{v.color}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700 }}>{v.size}</td>
                  <td style={{ padding: '6px 10px' }}><input style={{ ...input, fontFamily: 'monospace' }} value={v.sku} onChange={e => setVariant(v.color, v.size, { sku: e.target.value })} /></td>
                  <td style={{ padding: '6px 10px', width: '120px' }}><input style={input} type="number" value={v.base_cost} onChange={e => setVariant(v.color, v.size, { base_cost: e.target.value })} /></td>
                  <td style={{ padding: '6px 10px' }}><input type="checkbox" checked={v.in_stock} onChange={e => setVariant(v.color, v.size, { in_stock: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Print areas" hint="Drag the blue box on the photo. The orange box is the part the merchant's editor zooms into."
        action={<button style={button} onClick={() => { update({ print_areas: [...form.print_areas, { id: `area-${form.print_areas.length + 1}`, label: 'New area', width_in: 10, height_in: 10, min_dpi: 150, mockup_box: { x: 0.4, y: 0.3, w: 0.2 } }] }); setSelectedArea(form.print_areas.length) }}>+ Add area</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 420px) 1fr', gap: '20px', alignItems: 'start' }} className="admin-areas">
          <PrintAreaCanvas photoUrl={form.colors[previewColor]?.image_url} areas={form.print_areas} selected={selectedArea}
            onMove={pos => setArea(selectedArea, { mockup_box: { ...area.mockup_box, ...pos } })} />
          <div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {form.print_areas.map((a, i) => (
                <button key={i} onClick={() => setSelectedArea(i)} style={i === selectedArea ? primary : button}>{a.label}</button>
              ))}
            </div>
            {area && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div><span style={label}>ID</span><input style={input} value={area.id} onChange={e => setArea(selectedArea, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></div>
                <div><span style={label}>Label</span><input style={input} value={area.label} onChange={e => setArea(selectedArea, { label: e.target.value })} /></div>
                <div><span style={label}>Min DPI</span><input style={input} type="number" value={area.min_dpi} onChange={e => setArea(selectedArea, { min_dpi: e.target.value })} /></div>
                <div><span style={label}>Print width (in)</span><input style={input} type="number" step="0.5" value={area.width_in} onChange={e => setArea(selectedArea, { width_in: e.target.value })} /></div>
                <div><span style={label}>Print height (in)</span><input style={input} type="number" step="0.5" value={area.height_in} onChange={e => setArea(selectedArea, { height_in: e.target.value })} /></div>
                <div><span style={label}>Box width on photo (%)</span><input style={input} type="number" step="0.5" value={pct(area.mockup_box.w)} onChange={e => setArea(selectedArea, { mockup_box: { ...area.mockup_box, w: Number(e.target.value) / 100 } })} /></div>
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F3F4F6', paddingTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                    <input type="checkbox" checked={!!area.view} onChange={e => setArea(selectedArea, { view: e.target.checked ? { x: 0, y: 0, w: 0.5 } : undefined })} />
                    Zoom the merchant's editor into part of the photo
                  </label>
                </div>
                {area.view && ['x', 'y', 'w'].map(k => (
                  <div key={k}><span style={label}>Zoom {k === 'w' ? 'size' : k === 'x' ? 'left' : 'top'} (%)</span>
                    <input style={input} type="number" step="1" value={pct(area.view[k])} onChange={e => setArea(selectedArea, { view: { ...area.view, [k]: Number(e.target.value) / 100 } })} />
                  </div>
                ))}
                {form.print_areas.length > 1 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <button style={{ ...button, color: '#DC2626' }} onClick={() => { update({ print_areas: form.print_areas.filter((_, j) => j !== selectedArea) }); setSelectedArea(0) }}>Remove this area</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Size chart" hint="Garment measurements merchants see next to the product.">
        <div style={{ maxWidth: '320px', marginBottom: '12px' }}><span style={label}>Columns (comma separated)</span>
          <input style={input} value={chart.columns.join(', ')} onChange={e => update({ size_chart: { ...chart, columns: e.target.value.split(',').map(s => s.trim()) } })} />
        </div>
        <table style={{ borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr>{['Size', ...chart.columns].map((h, i) => <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>
            {form.sizes.map(s => (
              <tr key={s}>
                <td style={{ padding: '4px 10px', fontWeight: 700 }}>{s}</td>
                {chart.columns.map((_, ci) => (
                  <td key={ci} style={{ padding: '4px 6px', width: '90px' }}>
                    <input style={input} type="number" step="0.5" value={chart.rows?.[s]?.[ci] ?? ''} onChange={e => {
                      const row = [...(chart.rows?.[s] || chart.columns.map(() => ''))]
                      row[ci] = e.target.value
                      update({ size_chart: { ...chart, rows: { ...chart.rows, [s]: row } } })
                    }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

export default function CatalogueAdmin() {
  const [blanks, setBlanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    fetchBlanks().then(setBlanks).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  if (editing) {
    return (
      <BlankEditor
        initial={editing.blank}
        isNew={editing.isNew}
        onCancel={() => setEditing(null)}
        onSaved={saved => {
          setBlanks(list => [...list.filter(b => b.blank_id !== saved.blank_id), saved].sort((a, b) => a.sort_order - b.sort_order))
          setEditing(null)
          setNotice(`Saved ${saved.name}.`)
        }}
      />
    )
  }

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '16px' }}>Catalogue</span>
        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Blank products merchants can design on.</span>
        <button style={{ ...primary, marginLeft: 'auto' }} onClick={() => { setNotice(''); setEditing({ blank: NEW_BLANK, isNew: true }) }}>+ New product</button>
      </div>
      {notice && <div style={{ padding: '10px 24px', background: '#F0FDF4', color: '#166534', fontSize: '13px' }}>✓ {notice}</div>}
      {error && <div style={{ padding: '10px 24px', background: '#FEF2F2', color: '#DC2626', fontSize: '13px' }}>{error}</div>}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>Loading catalogue...</div>
      ) : blanks.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>No products yet</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Product', 'Colors', 'Sizes', 'Base cost', 'Print areas', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blanks.map(b => {
              const costs = b.variants.map(v => v.base_cost)
              const photo = b.colors.find(c => c.image_url)?.image_url
              return (
                <tr key={b.blank_id} style={{ borderTop: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: photo ? '#fff' : b.colors[0]?.hex, border: '1px solid #E5E7EB', overflow: 'hidden', flexShrink: 0 }}>
                        {photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{b.name}</div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'monospace' }}>{b.blank_id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>{b.colors.map(c => <span key={c.name} title={c.name} style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.hex, border: '1px solid #D1D5DB' }} />)}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{(b.sizes || []).join(', ')}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>₹{Math.min(...costs)}–{Math.max(...costs)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{b.print_areas.map(a => a.label).join(', ')}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: b.active ? '#D1FAE5' : '#F3F4F6', color: b.active ? '#065F46' : '#6B7280', padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600 }}>{b.active ? 'Visible' : 'Hidden'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button style={button} onClick={() => { setNotice(''); setEditing({ blank: b, isNew: false }) }}>Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
