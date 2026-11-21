import { useEffect, useState } from 'react'
import { fetchInvoiceSettings, saveInvoiceSettings, uploadBlankPhoto } from './api'
import { C, SERIF, panel, input, label, button, primary, outline } from './theme'
import Heading from './Heading'

// The details printed on every tax invoice and receipt. Invoices start being
// numbered once the legal name, GSTIN, state and address are saved.
const FIELD = (k, text, opts = {}) => ({ k, text, ...opts })
const BUSINESS = [
  FIELD('legal_name', 'LEGAL NAME', { placeholder: 'NO LIMIT STUDIO PRIVATE LIMITED', wide: true }),
  FIELD('gstin', 'GSTIN', { placeholder: '27ABCDE1234F1Z5', upper: true }),
  FIELD('cin', 'CIN (companies only)', { placeholder: 'U73100MH2024PTC000000' }),
  FIELD('address1', 'ADDRESS LINE 1', { wide: true }),
  FIELD('address2', 'ADDRESS LINE 2', { wide: true }),
  FIELD('city', 'CITY'),
  FIELD('pincode', 'PINCODE'),
  FIELD('phone', 'PHONE'),
  FIELD('email', 'EMAIL'),
]

function Section({ title, hint, children }) {
  return (
    <div style={{ ...panel, padding: '20px 24px', marginBottom: '14px' }}>
      <div style={{ fontFamily: SERIF, fontSize: '19px', color: C.ink }}>{title}</div>
      {hint && <div style={{ fontSize: '12px', color: C.muted, margin: '3px 0 0' }}>{hint}</div>}
      <div style={{ marginTop: '14px' }}>{children}</div>
    </div>
  )
}

function ImagePick({ title, url, onPick, busy }) {
  return (
    <div style={{ flex: '1 1 220px' }}>
      <span style={label}>{title}</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', border: `1px dashed ${C.rule}`, borderRadius: '12px', padding: '10px', cursor: 'pointer', background: C.wash }}>
        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onPick(e.target.files[0])} />
        <div style={{ width: '84px', height: '56px', borderRadius: '8px', background: url ? `#fff url("${url}") center/contain no-repeat` : C.card, border: `1px solid ${C.rule}` }} />
        <span style={{ fontSize: '12.5px', color: C.inkSoft }}>{busy ? 'Uploading…' : url ? 'Click to replace' : 'Upload PNG/JPG'}</span>
      </label>
    </div>
  )
}

export default function InvoiceSettingsAdmin() {
  const [form, setForm] = useState(null)
  const [meta, setMeta] = useState({ urls: {}, states: [], hsn_labels: {}, ready: false })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState('')

  const take = d => {
    const { urls, states, hsn_labels: hsnLabels, ready, ...values } = d
    setForm(values)
    setMeta({ urls: urls || {}, states, hsn_labels: hsnLabels, ready })
  }
  useEffect(() => { fetchInvoiceSettings().then(take).catch(e => setError(e.message)) }, [])
  const set = patch => { setForm(f => ({ ...f, ...patch })); setMsg(null) }

  async function pick(kind, file) {
    setUploading(kind)
    try {
      const key = await uploadBlankPhoto('invoice', file)
      set({ [kind]: key })
      setMeta(m => ({ ...m, urls: { ...m.urls, [kind]: URL.createObjectURL(file) } }))
    } catch (e) { setMsg({ ok: false, text: e.message }) } finally { setUploading('') }
  }
  async function save() {
    setBusy(true); setMsg(null)
    try { take(await saveInvoiceSettings(form)); setMsg({ ok: true, text: 'Saved' }) } catch (e) { setMsg({ ok: false, text: e.message }) } finally { setBusy(false) }
  }

  if (error) return <div style={{ color: C.red, fontSize: '13px' }}>{error}</div>
  if (!form) return <div style={{ color: C.muted, fontSize: '13px' }}>Loading…</div>
  const banks = form.banks || []
  const setBank = (i, patch) => set({ banks: banks.map((b, j) => (j === i ? { ...b, ...patch } : b)) })

  return (
    <div>
      <Heading eyebrow="Tax invoices & receipts" title="Invoices">
        <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '99px', background: meta.ready ? C.greenWash : C.goldWash, color: meta.ready ? C.green : C.gold }}>
          {meta.ready ? 'Invoices are on' : 'Not set up: add legal name, GSTIN, state and address'}
        </span>
      </Heading>
      <div style={{ ...panel, padding: '12px 16px', marginBottom: '14px', fontSize: '12.5px', color: C.inkSoft, lineHeight: 1.6 }}>
        Every paid order gets a <strong>tax invoice</strong> (manual and sample orders, Shopify orders sent to print, and branding orders once you approve the artwork). Wallet top-ups get a <strong>payment receipt</strong>.
        Numbers run per financial year: <code>{form.prefix || 'NLS'}/26-27/0001</code>, receipts <code>{form.prefix || 'NLS'}/RCPT/26-27/0001</code>. GST is split into CGST + SGST when the customer is in your state, otherwise IGST.
        Customers' "Bill To" comes from their Settings → Billing Details.
      </div>

      <Section title="Your business" hint="Printed at the top of every invoice.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          {BUSINESS.map(f => (
            <div key={f.k} style={{ gridColumn: f.wide ? '1 / -1' : undefined }}>
              <span style={label}>{f.text}</span>
              <input style={input} value={form[f.k] || ''} placeholder={f.placeholder} onChange={e => set({ [f.k]: f.upper ? e.target.value.toUpperCase() : e.target.value })} />
            </div>
          ))}
          <div>
            <span style={label}>STATE</span>
            <select style={input} value={form.state || ''} onChange={e => set({ state: e.target.value })}>
              <option value="">Select state</option>
              {meta.states.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '14px' }}>
          <ImagePick title="LOGO" url={meta.urls.logo_key} busy={uploading === 'logo_key'} onPick={f => pick('logo_key', f)} />
          <ImagePick title="SIGNATURE" url={meta.urls.signature_key} busy={uploading === 'signature_key'} onPick={f => pick('signature_key', f)} />
          <div style={{ flex: '1 1 220px' }}><span style={label}>SIGNATORY NAME</span><input style={input} value={form.signatory || ''} onChange={e => set({ signatory: e.target.value })} placeholder="Name above the signature" /></div>
        </div>
      </Section>

      <Section title="Invoice details">
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px' }}>
          <div><span style={label}>NUMBER PREFIX</span><input style={input} value={form.prefix || ''} onChange={e => set({ prefix: e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) })} /></div>
          <div><span style={label}>TERMS</span><input style={input} value={form.terms || ''} onChange={e => set({ terms: e.target.value })} placeholder="Due on Receipt" /></div>
          <div style={{ gridColumn: '1 / -1' }}><span style={label}>NOTES</span><textarea style={{ ...input, minHeight: '56px', resize: 'vertical' }} value={form.notes || ''} onChange={e => set({ notes: e.target.value })} /></div>
        </div>
      </Section>

      <Section title="HSN / SAC and GST" hint="GST on garments and shipping follows Settings (GST on products / shipping), so invoices always match what was charged.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {Object.entries(meta.hsn_labels).map(([k, text]) => (
            <div key={k}>
              <span style={label}>{text.toUpperCase()} · HSN/SAC</span>
              <input style={input} value={form.hsn?.[k]?.code || ''} onChange={e => set({ hsn: { ...form.hsn, [k]: { code: e.target.value.replace(/\D/g, '').slice(0, 8) } } })} />
            </div>
          ))}
          {[['hang_tag', 'HANG TAGS · GST %'], ['poly_bag', 'COURIER BAGS · GST %'], ['thank_you_card', 'THANK YOU CARDS · GST %']].map(([k, text]) => (
            <div key={k}>
              <span style={label}>{text}</span>
              <select style={input} value={String(form.branding_gst?.[k] ?? 18)} onChange={e => set({ branding_gst: { ...form.branding_gst, [k]: Number(e.target.value) } })}>
                {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '8px' }}>Branding prices you set are plus GST: brands pay the price + this GST %. Check the codes and rates with your CA.</div>
      </Section>

      <Section title="Payment details" hint="Bank accounts and UPI printed at the bottom left.">
        {banks.map((b, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto', gap: '8px', marginBottom: '10px', alignItems: 'end' }}>
            {[['label', 'HEADING', "Company's HDFC Bank Details"], ['holder', 'ACCOUNT HOLDER'], ['number', 'ACCOUNT NUMBER'], ['ifsc', 'IFSC'], ['branch', 'BRANCH'], ['type', 'ACCOUNT TYPE', 'CURRENT']].map(([k, text, ph]) => (
              <div key={k}><span style={label}>{text}</span><input style={input} value={b[k] || ''} placeholder={ph} onChange={e => setBank(i, { [k]: k === 'ifsc' ? e.target.value.toUpperCase() : e.target.value })} /></div>
            ))}
            <button style={button} onClick={() => set({ banks: banks.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        {banks.length < 4 && <button style={outline} onClick={() => set({ banks: [...banks, { label: '', holder: form.legal_name || '', number: '', ifsc: '', branch: '', type: 'CURRENT' }] })}>+ Add bank account</button>}
        <div style={{ maxWidth: '320px', marginTop: '14px' }}><span style={label}>UPI ID</span><input style={input} value={form.upi || ''} onChange={e => set({ upi: e.target.value })} placeholder="name@bank" /></div>
      </Section>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', bottom: '12px' }}>
        <button style={primary} disabled={busy || !!uploading} onClick={save}>{busy ? 'Saving…' : 'Save invoice details'}</button>
        {msg && <span style={{ fontSize: '13px', color: msg.ok ? C.green : C.red, background: C.card, padding: '4px 10px', borderRadius: '8px' }}>{msg.ok ? '✓ ' : ''}{msg.text}</span>}
      </div>
    </div>
  )
}
