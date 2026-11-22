import { useEffect, useState } from 'react'
import { fetchSettings, saveSettings, fetchAccountWallet, creditWallet } from './api'
import { C, SERIF, panel, input, label, primary, button } from './theme'
import Heading from './Heading'

const FIELDS = [
  ['surface_first', 'Surface: first item ₹'],
  ['surface_extra', 'Surface: each extra item ₹'],
  ['air_first', 'Air: first item ₹'],
  ['air_extra', 'Air: each extra item ₹'],
  ['product_tax_pct', 'GST on products %'],
  ['shipping_tax_pct', 'GST on shipping %'],
  ['sample_discount_pct', 'Sample discount % (Book a Sample)'],
  ['print_base', 'Printing: ₹ per printed side'],
  ['print_per_sq_in', 'Printing: ₹ per square inch'],
  ['cod_fee', 'COD fee ₹ per order (from the payout)'],
  ['rto_charge', 'Return (RTO) charge ₹ to the brand'],
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
                  <input style={input} type="number" min="0" step={key === 'print_per_sq_in' ? '0.01' : '1'} value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${C.ruleSoft}`, marginTop: '20px', paddingTop: '16px', fontSize: '13px', color: C.muted, lineHeight: 1.7 }}>
              <div><span style={{ color: C.ink, fontWeight: 500 }}>Example:</span> 1 item ships for ₹{ship('surface', 1)} surface or ₹{ship('air', 1)} air; 3 items for ₹{ship('surface', 3)} or ₹{ship('air', 3)}.</div>
              <div>GST is added on top: {values.product_tax_pct}% on products and {values.shipping_tax_pct}% on shipping.</div>
              <div><span style={{ color: C.ink, fontWeight: 500 }}>Printing (DTF), per printed side:</span> ₹{values.print_base} + ₹{values.print_per_sq_in} × the design's size in square inches. For example {[[8.37, 4.97], [12.62, 7.5], [12, 16]].map(([w, h]) => `${w}×${h} in = ₹${Math.round(Number(values.print_base) + Number(values.print_per_sq_in) * w * h)}`).join(' · ')}. A print area in Catalogue can override these.</div>
              <div><span style={{ color: C.ink, fontWeight: 500 }}>Cash on delivery:</span> a brand is paid what the courier collects minus ₹{values.cod_fee} per COD order. A returned parcel (RTO) charges ₹{values.rto_charge} to the brand's wallet. New orders keep the fee in force when they were placed.</div>
            </div>
          </>
        )}
      </div>
      <WalletCredit />
    </>
  )
}

const GTYPES = [['tee', 'Round-neck T-shirt'], ['polo', 'Polo'], ['hoodie', 'Hoodie']]
const GVIEWS = [['front', 'Front'], ['back', 'Back'], ['left-sleeve', 'Left sleeve'], ['right-sleeve', 'Right sleeve']]

// Default print cost per position for customers' own garments; each new
// garment starts with these and can be changed when reviewing it.
function AccountDetails({ account }) {
  const b = account.billing || {}, bank = account.bank || {}, s = account.shipping || {}
  const addr = a => [a.address1, a.address2, [a.city, a.state, a.pincode].filter(Boolean).join(', ')].filter(Boolean).join(', ')
  const rows = [
    b.business_name && ['Business', [b.business_name, b.gstin && `GSTIN ${b.gstin}`].filter(Boolean).join(' · ')],
    b.address1 && ['Billing address', addr(b)],
    (b.email || b.phone) && ['Billing contact', [b.email, b.phone].filter(Boolean).join(' · ')],
    bank.account_number && ['Bank account', `${bank.account_holder} · ${bank.account_number} · IFSC ${bank.ifsc}${bank.bank_name ? ` · ${bank.bank_name}` : ''}`],
    s.brand_name && ['Sender on parcels', s.brand_name],
    s.return_address && ['Return address', `${s.return_address.name} · ${addr(s.return_address)} · ${s.return_address.phone}`],
    s.default_method && ['Default shipping', s.default_method],
  ].filter(Boolean)
  if (!rows.length) return <div style={{ color: C.muted, marginTop: '6px' }}>No billing, bank or shipping details saved yet.</div>
  return (
    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: '14px', rowGap: '3px' }}>
      {rows.map(([k, v]) => [<span key={k + 'k'} style={{ color: C.muted }}>{k}</span>, <span key={k + 'v'} style={{ color: C.ink, wordBreak: 'break-word' }}>{v}</span>])}
    </div>
  )
}

function WalletCredit() {
  const [email, setEmail] = useState('')
  const [account, setAccount] = useState(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function lookUp() {
    setBusy(true); setError(''); setNotice(''); setAccount(null)
    try { setAccount(await fetchAccountWallet(email.trim())) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function credit() {
    if (!window.confirm(`Add ₹${amount} to ${email.trim()}'s wallet?`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await creditWallet(email.trim(), Number(amount), note.trim())
      setAccount(a => ({ ...(a || {}), email: res.email, balance: res.balance }))
      setNotice(`Added ₹${Number(res.credited)}. New balance ₹${Number(res.balance)}.`)
      setAmount(''); setNote('')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <Heading eyebrow="Accounts" title="Wallet credit" />
      <p style={{ color: C.muted, fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>Add money to an account's wallet without a payment: test credit for Shopify's reviewers, a refund, or goodwill. Shown in their wallet history; they get a receipt email.</p>
      {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 14px', borderRadius: '10px' }}>{error}</div>}
      {notice && <div style={{ color: C.green, fontSize: '13px', marginBottom: '16px', background: C.greenWash, padding: '10px 14px', borderRadius: '10px' }}>{notice}</div>}
      <div style={{ ...panel, padding: '22px 26px' }}>
        <span style={label}>ACCOUNT EMAIL</span>
        <div style={{ display: 'flex', gap: '8px', maxWidth: '520px' }}>
          <input style={input} type="email" value={email} onChange={e => { setEmail(e.target.value); setAccount(null) }} placeholder="customer@example.com" />
          <button style={button} disabled={busy || !email.includes('@')} onClick={lookUp}>Look up</button>
        </div>
        {account && (
          <div style={{ fontSize: '13px', color: C.inkSoft, marginTop: '10px', lineHeight: 1.6 }}>
            Balance <strong style={{ color: C.ink }}>₹{Number(account.balance)}</strong>
            {account.has_wallet === false && <span style={{ color: C.muted }}> · no wallet yet (it's created with the first credit)</span>}
            {account.stores?.length > 0 && <div style={{ color: C.muted }}>Linked stores: {account.stores.join(', ')}</div>}
            <AccountDetails account={account} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: '10px', alignItems: 'end', marginTop: '16px', maxWidth: '720px' }}>
          <div><span style={label}>AMOUNT ₹</span><input style={input} type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><span style={label}>NOTE (shown to the customer)</span><input style={input} value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="e.g. App Review test credit" /></div>
          <button style={primary} disabled={busy || !email.includes('@') || !(Number(amount) >= 1) || !note.trim()} onClick={credit}>{busy ? 'Saving…' : 'Add credit'}</button>
        </div>
      </div>
    </div>
  )
}
