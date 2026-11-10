import React, { useState, useEffect } from 'react'
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import CatalogueAdmin from './CatalogueAdmin'
import SettingsAdmin from './SettingsAdmin'
import { C, SERIF, SANS, panel, input, button, primary, outline, eyebrow, th, td, empty } from './theme'
import Heading from './Heading'

const provider = new GoogleAuthProvider()
import { fetchAllOrders, fetchAllStores, updateOrderStatus, fetchProductMappings, updateProductMapping } from './api'

const ALLOWED_EMAILS = [
  'umangkedia5@gmail.com',
  'hiddenappleclub@gmail.com',
]

const STATUS = {
  queued:    { label: 'Queued',       color: C.gold,  wash: C.goldWash },
  printing:  { label: 'On the press', color: C.blue,  wash: C.blueWash },
  shipped:   { label: 'Shipped',      color: C.green, wash: C.greenWash },
  delivered: { label: 'Delivered',    color: C.muted, wash: C.wash },
}
const STATUS_NEXT = { queued: 'printing', printing: 'shipped', shipped: 'delivered' }
const ACTION_LABEL = { printing: 'Start print', shipped: 'Mark shipped', delivered: 'Mark delivered' }

// New orders arrive with Shopify's payment status ("paid", "pending"...) until
// someone moves them along; for the print floor they're simply queued.
const stageOf = order => (STATUS[order.status] ? order.status : 'queued')

function customerName(order) {
  const raw = order.raw || {}
  const ship = raw.shipping_address || raw.billing_address || {}
  const cust = raw.customer || {}
  return ship.name || [cust.first_name, cust.last_name].filter(Boolean).join(' ') || order.email || 'Guest'
}

function money(amount, currency) {
  const n = parseFloat(amount || 0)
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${currency || ''} ${n.toFixed(2)}`
  }
}

const longDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function StatusLabel({ stage }) {
  const s = STATUS[stage]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 500, color: s.color }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

function Wordmark({ size = 17 }) {
  return (
    <span style={{ fontFamily: SERIF, fontSize: `${size}px`, fontWeight: 500, letterSpacing: '0.01em', color: C.ink, whiteSpace: 'nowrap' }}>
      No Limit <i style={{ color: C.gold, fontWeight: 400 }}>Studio</i>
    </span>
  )
}

function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogleLogin() {
    setError('')
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, provider)
      if (!ALLOWED_EMAILS.includes(result.user.email)) {
        await signOut(auth)
        setError("This Google account isn't on the admin list.")
      }
    } catch {
      setError("Sign-in didn't complete. Try again.")
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.paper, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <Wordmark size={26} />
        <div style={{ ...eyebrow, marginTop: '10px' }}>Atelier admin</div>
        <div style={{ ...panel, padding: '32px', marginTop: '28px' }}>
          <p style={{ fontFamily: SERIF, fontSize: '20px', color: C.ink, marginBottom: '6px' }}>Welcome back</p>
          <p style={{ color: C.muted, fontSize: '13px', marginBottom: '24px' }}>Sign in with your studio Google account.</p>
          {error && <div style={{ color: C.red, fontSize: '13px', marginBottom: '16px', background: C.redWash, padding: '10px 12px', borderRadius: '10px' }}>{error}</div>}
          <button onClick={handleGoogleLogin} disabled={loading}
            style={{ ...outline, width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/></svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductRow({ shop, product, onSaved }) {
  const [factorySku, setFactorySku] = useState(product.factorySku || '')
  const [fulfillmentCost, setFulfillmentCost] = useState(product.fulfillmentCost ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = factorySku !== (product.factorySku || '') || String(fulfillmentCost) !== String(product.fulfillmentCost ?? '')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateProductMapping({
        shop,
        shopifyProductId: product.id,
        factorySku,
        fulfillmentCost: fulfillmentCost === '' ? null : Number(fulfillmentCost),
      })
      onSaved()
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="atelier-row">
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: C.wash, overflow: 'hidden', flexShrink: 0 }}>
            {product.image && <img src={product.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{product.name}</div>
            <div style={{ fontSize: '11px', color: C.faint, fontFamily: 'monospace' }}>#{product.id}</div>
          </div>
        </div>
      </td>
      <td style={td}>
        {product.printFileUrl
          ? <a href={product.printFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecorationColor: C.gold, textUnderlineOffset: '3px' }}>View file</a>
          : <span style={{ color: C.faint }}>Not set by merchant</span>}
      </td>
      <td style={td}>
        <input value={factorySku} onChange={e => setFactorySku(e.target.value)} placeholder="GILDAN-64000-BLK" style={{ ...input, width: '180px', fontFamily: 'monospace', fontSize: '12px' }} />
      </td>
      <td style={td}>
        <input type="number" value={fulfillmentCost} onChange={e => setFulfillmentCost(e.target.value)} placeholder="₹" style={{ ...input, width: '100px' }} />
      </td>
      <td style={td}>
        <button onClick={handleSave} disabled={saving || !dirty} style={dirty ? primary : button}>{saving ? 'Saving…' : 'Save'}</button>
        {error && <div style={{ color: C.red, fontSize: '11px', marginTop: '4px' }}>{error}</div>}
      </td>
    </tr>
  )
}

// The first line item's print file (or its Shopify photo) as the order's face.
function OrderThumb({ items }) {
  const first = (items || [])[0] || {}
  const thumb = first.print_file_url || first.image_url
  return (
    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: C.wash, overflow: 'hidden', border: `1px solid ${C.rule}`, flexShrink: 0 }}>
      {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  )
}

function PrintFiles({ items }) {
  const list = items || []
  const missing = list.filter(i => !i.print_file_url).length
  return (
    <div>
      <div>{list.length} item{list.length === 1 ? '' : 's'}</div>
      {list.length > 0 && (
        missing
          ? <div style={{ fontSize: '11px', color: C.red }}>{missing} without print file</div>
          : <div style={{ fontSize: '11px', color: C.green }}>Print files ready</div>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
        {list.filter(i => i.print_file_url).map((i, idx) => (
          <a key={idx} href={i.print_file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: C.muted, textDecorationColor: C.rule, textUnderlineOffset: '3px' }}>File {idx + 1}</a>
        ))}
      </div>
    </div>
  )
}

function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [productShop, setProductShop] = useState('')
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (stores.length && !productShop) setProductShop(stores[0].shop_domain)
  }, [stores])

  useEffect(() => {
    if (activeTab === 'products' && productShop) loadProducts()
  }, [activeTab, productShop])

  async function loadProducts() {
    setProductsLoading(true)
    const p = await fetchProductMappings(productShop)
    setProducts(p)
    setProductsLoading(false)
  }

  async function loadData() {
    setLoading(true)
    const [o, s] = await Promise.all([fetchAllOrders(), fetchAllStores()])
    setOrders(o)
    setStores(s)
    setLoading(false)
  }

  // Only show the new status once the server has saved it.
  async function handleStatusChange(order, nextStatus) {
    setUpdatingId(order.order_id)
    setStatusError('')
    try {
      await updateOrderStatus(order.order_id, order.shop_domain, nextStatus)
      setOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, status: nextStatus } : o))
    } catch (err) {
      setStatusError(`${order.order_name || order.order_id}: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const q = search.trim().toLowerCase()
  const filteredOrders = orders
    .filter(o => {
      const matchStatus = filterStatus === 'all' || stageOf(o) === filterStatus
      const matchSearch = !q || [o.order_name, o.shop_domain, o.account_email, o.email, customerName(o)].some(v => (v || '').toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const count = stage => orders.filter(o => stageOf(o) === stage).length
  const stats = [
    { label: 'Orders', value: orders.length },
    { label: 'Queued', value: count('queued') },
    { label: 'On the press', value: count('printing') },
    { label: 'Shipped', value: count('shipped') },
    { label: 'Stores', value: stores.length },
  ]

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const queued = count('queued'), printing = count('printing')
  const summary = loading ? 'Gathering the orders…'
    : queued ? `${queued} order${queued === 1 ? ' is' : 's are'} waiting for the press.`
    : printing ? `${printing} order${printing === 1 ? ' is' : 's are'} on the press.`
    : 'All caught up.'

  const NAV = [
    { id: 'orders', label: 'Orders' },
    { id: 'stores', label: 'Stores' },
    { id: 'products', label: 'Products' },
    { id: 'catalogue', label: 'Catalogue' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.paper, fontFamily: SANS, color: C.ink }}>
      <header style={{ borderBottom: `1px solid ${C.rule}`, background: C.paper, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '36px', height: '64px' }}>
          <Wordmark />
          <nav style={{ display: 'flex', gap: '26px', height: '100%' }}>
            {NAV.map(n => {
              const on = activeTab === n.id
              return (
                <button key={n.id} onClick={() => setActiveTab(n.id)}
                  style={{ background: 'none', border: 'none', borderBottom: `1.5px solid ${on ? C.ink : 'transparent'}`, color: on ? C.ink : C.muted, fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: '0 2px', height: '100%', fontFamily: SANS }}>
                  {n.label}
                </button>
              )
            })}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
            <span style={{ color: C.muted }}>{user.email}</span>
            <button onClick={() => signOut(auth)} style={{ ...button, padding: '6px 14px', fontSize: '12px' }}>Sign out</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '36px 32px 64px' }}>
        {activeTab === 'orders' && (
          <>
            <div style={eyebrow}>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <h1 style={{ fontFamily: SERIF, fontSize: '34px', fontWeight: 400, letterSpacing: '-0.015em', marginTop: '8px', lineHeight: 1.2 }}>
              {greeting}. <span style={{ color: C.muted }}>{summary}</span>
            </h1>

            <div className="atelier-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}`, margin: '28px 0 32px' }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{ padding: '18px 20px', borderLeft: i ? `1px solid ${C.rule}` : 'none' }}>
                  <div style={{ fontSize: '12px', color: C.muted }}>{s.label}</div>
                  <div style={{ fontFamily: SERIF, fontSize: '34px', fontWeight: 400, marginTop: '2px', lineHeight: 1.1 }}>{loading ? '–' : s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, customer or store"
                style={{ ...input, flex: '1 1 260px', width: 'auto', borderRadius: '99px', padding: '10px 18px' }} />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['all', 'queued', 'printing', 'shipped', 'delivered'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{ ...(filterStatus === s ? primary : button), padding: '7px 14px', fontSize: '12px' }}>
                    {s === 'all' ? 'All' : STATUS[s].label}
                  </button>
                ))}
              </div>
              <button onClick={loadData} style={{ ...button, padding: '7px 14px', fontSize: '12px' }}>Refresh</button>
            </div>

            {statusError && <div style={{ color: C.red, fontSize: '13px', marginBottom: '12px', background: C.redWash, padding: '10px 14px', borderRadius: '10px' }}>{statusError}</div>}
            <div style={{ ...panel, overflow: 'hidden' }}>
              {loading ? (
                <div style={empty}>Loading orders…</div>
              ) : filteredOrders.length === 0 ? (
                <div style={empty}>{orders.length ? 'No orders match.' : 'No orders yet.'}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead>
                      <tr>{['', 'Order', 'Customer', 'Print files', 'Amount', 'Status', 'Placed', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o, i) => {
                        const stage = stageOf(o)
                        const next = STATUS_NEXT[stage]
                        const busy = updatingId === o.order_id
                        return (
                          <tr key={o.order_id || i} className="atelier-row">
                            <td style={{ ...td, width: '60px' }}><OrderThumb items={o.items} /></td>
                            <td style={td}>
                              <div style={{ fontFamily: SERIF, fontSize: '17px' }}>{(o.order_name || `#${o.order_id}`).replace('#', '')}</div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: o.source === 'manual' ? C.gold : C.muted, background: o.source === 'manual' ? C.goldWash : C.wash, padding: '1px 7px', borderRadius: '99px' }}>{o.source === 'manual' ? 'Manual' : 'Shopify'}</span>
                                {o.reference && <span style={{ fontSize: '11px', color: C.faint }}>Ref {o.reference}</span>}
                              </div>
                            </td>
                            <td style={td}>
                              <div style={{ fontWeight: 500 }}>{customerName(o)}</div>
                              <div style={{ fontSize: '12px', color: C.muted }}>{o.account_email || (o.shop_domain || '').replace('.myshopify.com', '')}</div>
                            </td>
                            <td style={{ ...td, fontSize: '12px' }}><PrintFiles items={o.items} /></td>
                            <td style={{ ...td, fontWeight: 500, whiteSpace: 'nowrap' }}>{money(o.total_price, o.currency)}</td>
                            <td style={td}><StatusLabel stage={stage} /></td>
                            <td style={{ ...td, color: C.muted, whiteSpace: 'nowrap', fontSize: '12px' }}>{longDate(o.created_at)}</td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              {next && (
                                <button onClick={() => handleStatusChange(o, next)} disabled={busy}
                                  style={{ ...(stage === 'queued' ? outline : primary), padding: '7px 16px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                  {busy ? 'Saving…' : ACTION_LABEL[next]}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'stores' && (
          <>
            <Heading eyebrow="Merchants" title={`Connected stores${loading ? '' : ` · ${stores.length}`}`} />
            <div style={{ ...panel, overflow: 'hidden' }}>
              {loading ? (
                <div style={empty}>Loading stores…</div>
              ) : stores.length === 0 ? (
                <div style={empty}>No stores connected yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Store', 'Plan', 'Orders', 'Installed'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stores.map((s, i) => {
                      const paid = s.current_plan && s.current_plan !== 'free'
                      return (
                        <tr key={s.shop_domain || i} className="atelier-row">
                          <td style={td}>
                            <div style={{ fontFamily: SERIF, fontSize: '16px' }}>{(s.shop_domain || '').replace('.myshopify.com', '')}</div>
                            <div style={{ fontSize: '11px', color: C.faint }}>{s.shop_domain}</div>
                          </td>
                          <td style={td}>
                            <span style={{ background: paid ? C.goldWash : C.wash, color: paid ? C.gold : C.muted, padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize' }}>{s.current_plan || 'free'}</span>
                          </td>
                          <td style={td}>{orders.filter(o => o.shop_domain === s.shop_domain).length}</td>
                          <td style={{ ...td, color: C.muted }}>{longDate(s.installed_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'products' && (
          <>
            <Heading eyebrow="Fulfilment" title="Store products">
              <select value={productShop} onChange={e => setProductShop(e.target.value)} style={{ ...input, width: 'auto', borderRadius: '99px', padding: '8px 14px' }}>
                {stores.map(s => <option key={s.shop_domain} value={s.shop_domain}>{s.shop_domain}</option>)}
              </select>
              <button onClick={loadProducts} style={button}>Refresh</button>
            </Heading>
            <p style={{ color: C.muted, fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>Factory SKU and fulfilment cost are set here by the studio, not by merchants.</p>
            <div style={{ ...panel, overflow: 'hidden' }}>
              {productsLoading ? (
                <div style={empty}>Loading products…</div>
              ) : !productShop ? (
                <div style={empty}>No stores connected yet.</div>
              ) : products.length === 0 ? (
                <div style={empty}>No products in this store.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
                    <thead><tr>{['Product', 'Print file', 'Factory SKU', 'Fulfilment cost', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {products.map(p => <ProductRow key={p.id} shop={productShop} product={p} onSaved={loadProducts} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'catalogue' && <CatalogueAdmin />}
        {activeTab === 'settings' && <SettingsAdmin />}
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, u => { setUser(u); setChecking(false) })
  }, [])

  if (checking) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.paper, fontFamily: SERIF, color: C.muted, fontSize: '18px' }}>No Limit Studio…</div>
  if (!user || !ALLOWED_EMAILS.includes(user.email)) return <LoginPage />
  return <AdminDashboard user={user} />
}
