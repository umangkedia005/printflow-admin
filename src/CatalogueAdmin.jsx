import { useEffect, useRef, useState } from 'react'
import { fetchBlanks, saveBlank, uploadBlankPhoto } from './api'
import { C, SERIF, panel as card, input, label, button, primary, th, td, empty } from './theme'
import Heading from './Heading'

// One photo per view for every color; each print area sits on one view.
const STANDARD_VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left-sleeve', label: 'Left sleeve' },
  { id: 'right-sleeve', label: 'Right sleeve' },
]
const STANDARD_AREAS = {
  'front': { id: 'front', label: 'Front', view_id: 'front', width_in: 12, height_in: 16, min_dpi: 150, print_cost: 0, mockup_box: { x: 0.33, y: 0.25, w: 0.34 } },
  'back': { id: 'back', label: 'Back', view_id: 'back', width_in: 12, height_in: 16, min_dpi: 150, print_cost: 0, mockup_box: { x: 0.33, y: 0.25, w: 0.34 } },
  'left-sleeve': { id: 'left-sleeve', label: 'Left sleeve', view_id: 'left-sleeve', width_in: 3, height_in: 4, min_dpi: 150, print_cost: 0, mockup_box: { x: 0.45, y: 0.35, w: 0.1 } },
  'right-sleeve': { id: 'right-sleeve', label: 'Right sleeve', view_id: 'right-sleeve', width_in: 3, height_in: 4, min_dpi: 150, print_cost: 0, mockup_box: { x: 0.45, y: 0.35, w: 0.1 } },
}

const NEW_BLANK = {
  blank_id: '', name: '', category: '', description: '', fabric: '', gsm: 180, fit: 'Regular',
  mockup: 'tee', sort_order: 99, active: false,
  views: STANDARD_VIEWS,
  colors: [{ name: 'White', hex: '#FFFFFF', images: {} }],
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  variants: [],
  print_areas: Object.values(STANDARD_AREAS),
  size_chart: { unit: 'in', columns: ['Chest', 'Length'], rows: {} },
}

// Switch a product to Front / Back / Left sleeve / Right sleeve. Areas named
// after a view move onto it, any other area (e.g. left chest) onto Front;
// their boxes need re-dragging on the new photos. Missing standard areas are
// added and photos for old views are dropped.
function withStandardViews(form) {
  const ids = STANDARD_VIEWS.map(v => v.id)
  const moved = form.print_areas.map(a => ({ ...a, view_id: ids.includes(a.id) ? a.id : 'front', zoom: undefined }))
  const added = ids.filter(id => !moved.some(a => a.id === id)).map(id => STANDARD_AREAS[id])
  return {
    ...form,
    views: STANDARD_VIEWS,
    colors: form.colors.map(c => ({
      ...c,
      images: Object.fromEntries(Object.entries(c.images || {}).filter(([v]) => ids.includes(v))),
      image_urls: Object.fromEntries(Object.entries(c.image_urls || {}).filter(([v]) => ids.includes(v))),
    })),
    print_areas: [...moved, ...added],
  }
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
    <div style={{ ...card, padding: '22px 26px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: '19px' }}>{title}</div>
          {hint && <div style={{ fontSize: '12px', color: C.muted, marginTop: '3px' }}>{hint}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// The product photo with every print area drawn on it; the selected area can
// be dragged. Positions are fractions of the (square) photo.
function PrintAreaCanvas({ photoUrl, areas, selected, viewId, onMove }) {
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
    <div ref={ref} style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: photoUrl ? C.card : C.wash, border: '1px solid #E9E3D6', borderRadius: '10px', overflow: 'hidden' }}>
      {photoUrl
        ? <img src={photoUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' }} />
        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: '12px', textAlign: 'center', padding: '20px' }}>No photo for this color and view yet.</div>}
      {areas.map((a, i) => {
        if ((a.view_id || viewId) !== viewId) return null
        const b = a.mockup_box
        const h = b.w * a.height_in / a.width_in
        const on = i === selected
        return (
          <div key={i}>
            {on && a.zoom && (
              <div style={{ position: 'absolute', left: `${a.zoom.x * 100}%`, top: `${a.zoom.y * 100}%`, width: `${a.zoom.w * 100}%`, height: `${a.zoom.w * 100}%`, border: '1.5px dashed #F59E0B', pointerEvents: 'none' }} />
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

  async function handlePhoto(i, viewId, e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!form.blank_id) return setError('Set the product ID before uploading photos.')
    try {
      const { url, w, h } = await readImageSize(file)
      if (Math.abs(w - h) / Math.max(w, h) > 0.02) return setError(`Photos must be square (this one is ${w}×${h}).`)
      setUploading(`${i}|${viewId}`)
      const key = await uploadBlankPhoto(form.blank_id, file)
      setForm(f => ({ ...f, colors: f.colors.map((c, j) => (j === i ? { ...c, images: { ...c.images, [viewId]: key }, image_urls: { ...c.image_urls, [viewId]: url } } : c)) }))
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
  const views = form.views?.length ? form.views : [{ id: 'main', label: 'Main' }]
  const areaView = area?.view_id || views[0].id
  const missingPhotos = form.colors.flatMap(c => views.filter(v => !c.images?.[v.id]).map(v => `${c.name} ${v.label}`))
  const isStandard = views.every(v => STANDARD_VIEWS.some(sv => sv.id === v.id))
  const addableViews = STANDARD_VIEWS.filter(sv => !views.some(v => v.id === sv.id))

  // Not every product has every side (a cap or poster may be front only), so
  // views are added one at a time; a standard view brings its default area.
  function addView(choice) {
    let view = STANDARD_VIEWS.find(v => v.id === choice)
    if (choice === 'other') {
      const name = window.prompt('Name of the view, e.g. Inside label')?.trim()
      if (!name) return
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
      if (id.length < 2 || views.some(v => v.id === id)) return setError('That view already exists or the name is too short.')
      view = { id, label: name }
    }
    if (!view) return
    const area = STANDARD_AREAS[view.id]
    update({
      views: [...views, view],
      print_areas: area && !form.print_areas.some(a => a.id === area.id) ? [...form.print_areas, area] : form.print_areas,
    })
  }

  // Removing a view also drops its print areas and its photos, so nothing is
  // left pointing at a view that no longer exists.
  function removeView(viewId) {
    setForm(f => syncVariants({
      ...f,
      views: views.filter(v => v.id !== viewId),
      print_areas: f.print_areas.filter(a => (a.view_id || views[0].id) !== viewId),
      colors: f.colors.map(c => ({
        ...c,
        images: Object.fromEntries(Object.entries(c.images || {}).filter(([v]) => v !== viewId)),
        image_urls: Object.fromEntries(Object.entries(c.image_urls || {}).filter(([v]) => v !== viewId)),
      })),
    }))
    setSelectedArea(0)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onCancel} style={button}>← Back</button>
          <span style={{ fontFamily: SERIF, fontWeight: 500, fontSize: '28px' }}>{isNew ? 'New product' : form.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <input type="checkbox" checked={form.active} onChange={e => update({ active: e.target.checked })} /> Visible to merchants
          </label>
          <button onClick={handleSave} disabled={saving} style={{ ...primary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save product'}</button>
        </div>
      </div>
      {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}

      <Section title="Basics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          <div><span style={label}>Product ID</span><input style={{ ...input, background: isNew ? C.card : C.paper }} value={form.blank_id} disabled={!isNew} placeholder="e.g. classic-polo" onChange={e => update({ blank_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></div>
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

      <Section title="Views" hint="The sides this product has photos of. Add only the ones it needs; every color needs one square photo per view."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isStandard && <button style={button} onClick={() => { setForm(f => syncVariants(withStandardViews(f))); setSelectedArea(0) }}>Switch to front, back and sleeves</button>}
            <select style={{ ...input, width: 'auto', fontWeight: 600 }} value="" onChange={e => addView(e.target.value)}>
              <option value="" disabled>+ Add view</option>
              {addableViews.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              <option value="other">Other…</option>
            </select>
          </div>
        }>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {views.map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', border: '1px solid #E9E3D6', borderRadius: '8px', padding: '6px 8px' }}>
              <input style={{ ...input, width: '130px' }} value={v.label} onChange={e => update({ views: views.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{v.id}</span>
              {views.length > 1 && <button title={`Remove ${v.label} with its photos and print areas`} style={{ ...button, padding: '4px 8px', fontSize: '12px', color: C.red }} onClick={() => removeView(v.id)}>✕</button>}
            </div>
          ))}
        </div>
        {!isStandard && <p style={{ fontSize: '12px', color: C.muted, marginTop: '10px' }}>This product still uses one combined photo. Switching gives it separate front, back and sleeve photos (remove any it doesn't have); SKUs and costs are kept, and each print box needs dragging onto the new photos.</p>}
      </Section>

      <Section title="Colors and photos" hint="Square photos (e.g. 2048×2048), same framing in every color so print boxes line up."
        action={<button style={button} onClick={() => update({ colors: [...form.colors, { name: `Color ${form.colors.length + 1}`, hex: '#CCCCCC', images: {} }] })}>+ Add color</button>}>
        {missingPhotos.length > 0 && (
          <div style={{ fontSize: '12px', color: C.gold, background: C.goldWash, padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>Missing photos: {missingPhotos.slice(0, 6).join(', ')}{missingPhotos.length > 6 ? ` and ${missingPhotos.length - 6} more` : ''}.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {form.colors.map((c, i) => (
            <div key={i} style={{ border: '1px solid #E9E3D6', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input style={{ ...input, width: '180px' }} value={c.name} onChange={e => setColor(i, { name: e.target.value })} />
                <input type="color" value={c.hex} onChange={e => setColor(i, { hex: e.target.value.toUpperCase() })} style={{ width: '40px', height: '34px', border: '1px solid #E9E3D6', borderRadius: '8px', padding: '2px', flexShrink: 0 }} />
                <button style={{ ...button, padding: '6px 10px', fontSize: '12px' }} onClick={() => setPreviewColor(i)}>{previewColor === i ? '✓ Shown in print areas' : 'Show in print areas'}</button>
                {form.colors.length > 1 && <button style={{ ...button, padding: '6px 10px', fontSize: '12px', color: C.red, marginLeft: 'auto' }} onClick={() => { update({ colors: form.colors.filter((_, j) => j !== i) }); setPreviewColor(0) }}>Remove color</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                {views.map(v => {
                  const url = c.image_urls?.[v.id]
                  const busy = uploading === `${i}|${v.id}`
                  return (
                    <label key={v.id} style={{ cursor: 'pointer' }}>
                      <div style={{ aspectRatio: '1 / 1', background: url ? C.card : C.paper, border: `1px ${url ? 'solid' : 'dashed'} #E9E3D6`, borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: C.muted, textAlign: 'center' }}>
                        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : busy ? 'Uploading…' : '+ Upload'}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: C.muted, marginTop: '4px', textAlign: 'center' }}>{v.label}{url ? ' · replace' : ''}</div>
                      <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => handlePhoto(i, v.id, e)} />
                    </label>
                  )
                })}
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
            <thead><tr style={{ background: C.paper }}>{['Color', 'Size', 'Factory SKU', 'Base cost ₹', 'In stock'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', color: C.muted, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {form.variants.map(v => (
                <tr key={variantKey(v.color, v.size)} style={{ borderTop: '1px solid #F1ECE1' }}>
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
        action={<button style={button} onClick={() => { update({ print_areas: [...form.print_areas, { id: `area-${form.print_areas.length + 1}`, label: 'New area', view_id: areaView, width_in: 10, height_in: 10, min_dpi: 150, print_cost: 0, mockup_box: { x: 0.4, y: 0.3, w: 0.2 } }] }); setSelectedArea(form.print_areas.length) }}>+ Add area</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 420px) 1fr', gap: '20px', alignItems: 'start' }} className="admin-areas">
          <PrintAreaCanvas photoUrl={form.colors[previewColor]?.image_urls?.[areaView]} areas={form.print_areas} selected={selectedArea} viewId={areaView}
            onMove={pos => setArea(selectedArea, { mockup_box: { ...area.mockup_box, ...pos } })} />
          <div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {form.print_areas.map((a, i) => (
                <button key={i} onClick={() => setSelectedArea(i)} style={i === selectedArea ? primary : button}>
                  {a.label}{views.length > 1 ? <span style={{ fontWeight: 400, opacity: 0.6 }}> · {views.find(v => v.id === a.view_id)?.label || '?'}</span> : null}
                </button>
              ))}
            </div>
            {area && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div><span style={label}>ID</span><input style={input} value={area.id} onChange={e => setArea(selectedArea, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></div>
                <div><span style={label}>Label</span><input style={input} value={area.label} onChange={e => setArea(selectedArea, { label: e.target.value })} /></div>
                <div><span style={label}>Printed on view</span>
                  <select style={input} value={areaView} onChange={e => setArea(selectedArea, { view_id: e.target.value })}>{views.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
                </div>
                <div><span style={label}>Print width (in)</span><input style={input} type="number" step="0.5" value={area.width_in} onChange={e => setArea(selectedArea, { width_in: e.target.value })} /></div>
                <div><span style={label}>Print height (in)</span><input style={input} type="number" step="0.5" value={area.height_in} onChange={e => setArea(selectedArea, { height_in: e.target.value })} /></div>
                <div><span style={label}>Min DPI</span><input style={input} type="number" value={area.min_dpi} onChange={e => setArea(selectedArea, { min_dpi: e.target.value })} /></div>
                <div><span style={label}>Print cost ₹ (added per item)</span><input style={input} type="number" value={area.print_cost ?? 0} onChange={e => setArea(selectedArea, { print_cost: e.target.value })} /></div>
                <div><span style={label}>Box width on photo (%)</span><input style={input} type="number" step="0.5" value={pct(area.mockup_box.w)} onChange={e => setArea(selectedArea, { mockup_box: { ...area.mockup_box, w: Number(e.target.value) / 100 } })} /></div>
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F1ECE1', paddingTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                    <input type="checkbox" checked={!!area.zoom} onChange={e => setArea(selectedArea, { zoom: e.target.checked ? { x: 0, y: 0, w: 0.5 } : undefined })} />
                    Zoom the merchant's editor into part of the photo (for photos showing several sides)
                  </label>
                </div>
                {area.zoom && ['x', 'y', 'w'].map(k => (
                  <div key={k}><span style={label}>Zoom {k === 'w' ? 'size' : k === 'x' ? 'left' : 'top'} (%)</span>
                    <input style={input} type="number" step="1" value={pct(area.zoom[k])} onChange={e => setArea(selectedArea, { zoom: { ...area.zoom, [k]: Number(e.target.value) / 100 } })} />
                  </div>
                ))}
                {form.print_areas.length > 1 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <button style={{ ...button, color: C.red }} onClick={() => { update({ print_areas: form.print_areas.filter((_, j) => j !== selectedArea) }); setSelectedArea(0) }}>Remove this area</button>
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
          <thead><tr>{['Size', ...chart.columns].map((h, i) => <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: C.muted, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
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
    <>
    <Heading eyebrow="Blanks merchants design on" title="Catalogue">
      <button style={primary} onClick={() => { setNotice(''); setEditing({ blank: NEW_BLANK, isNew: true }) }}>New product</button>
    </Heading>
    <div style={{ ...card, overflow: 'hidden' }}>
      {notice && <div style={{ padding: '12px 24px', background: C.greenWash, color: C.green, fontSize: '13px', borderBottom: `1px solid ${C.rule}` }}>{notice}</div>}
      {error && <div style={{ padding: '12px 24px', background: C.redWash, color: C.red, fontSize: '13px', borderBottom: `1px solid ${C.rule}` }}>{error}</div>}
      {loading ? (
        <div style={empty}>Loading catalogue…</div>
      ) : blanks.length === 0 ? (
        <div style={empty}>No products yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Product', 'Colors', 'Sizes', 'Base cost', 'Views', 'Print areas', 'Status', ''].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blanks.map(b => {
              const costs = b.variants.map(v => v.base_cost)
              const photo = b.colors.map(c => c.image_urls?.[b.views?.[0]?.id] || c.image_url).find(Boolean)
              return (
                <tr key={b.blank_id} className="atelier-row">
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: photo ? C.card : b.colors[0]?.hex, border: '1px solid #E9E3D6', overflow: 'hidden', flexShrink: 0 }}>
                        {photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div>
                        <div style={{ fontFamily: SERIF, fontSize: '17px' }}>{b.name}</div>
                        <div style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{b.blank_id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '4px' }}>{b.colors.map(c => <span key={c.name} title={c.name} style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.hex, border: '1px solid #E9E3D6' }} />)}</div>
                  </td>
                  <td style={td}>{(b.sizes || []).join(', ')}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>₹{Math.min(...costs)}–{Math.max(...costs)}</td>
                  <td style={td}>{(b.views || []).map(v => v.label).join(', ')}</td>
                  <td style={td}>{b.print_areas.map(a => a.label).join(', ')}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 500, color: b.active ? C.green : C.muted }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: b.active ? C.green : C.faint }} />{b.active ? 'Visible' : 'Hidden'}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button style={button} onClick={() => { setNotice(''); setEditing({ blank: b, isNew: false }) }}>Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
    </>
  )
}
