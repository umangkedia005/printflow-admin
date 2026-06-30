import React, { useState, useEffect } from 'react'
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

const provider = new GoogleAuthProvider()
import { fetchAllOrders, fetchAllStores, updateOrderStatus } from './api'

const ALLOWED_EMAILS = [
  'umangkedia5@gmail.com',
  'hiddenappleclub@gmail.com',
]

const STATUS_COLORS = {
  queued:    { bg: '#FEF9C3', text: '#854D0E' },
  printing:  { bg: '#DBEAFE', text: '#1E40AF' },
  shipped:   { bg: '#D1FAE5', text: '#065F46' },
  delivered: { bg: '#F3F4F6', text: '#374151' },
}

const STATUS_NEXT = { queued: 'printing', printing: 'shipped', shipped: 'delivered' }
const STATUS_LABEL = { queued: 'Queued', printing: 'Printing', shipped: 'Shipped', delivered: 'Delivered' }

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.queued
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600 }}>
      {STATUS_LABEL[status] || status}
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
        setError('Access denied. Your account is not authorized.')
      }
    } catch {
      setError('Sign in failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9F9F7' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', width: '380px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', background: '#0A0A0A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>P</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: '18px', fontFamily: 'system-ui' }}>No Limit Studio Admin</span>
        </div>
        <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '32px' }}>Sign in with your authorized Google account</p>
        {error && <div style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', background: '#FEF2F2', padding: '10px', borderRadius: '8px' }}>{error}</div>}
        <button onClick={handleGoogleLogin} disabled={loading}
          style={{ width: '100%', background: '#fff', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/></svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>
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
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [o, s] = await Promise.all([fetchAllOrders(), fetchAllStores()])
    setOrders(o)
    setStores(s)
    setLoading(false)
  }

  async function handleStatusChange(order, nextStatus) {
    setUpdatingId(order.order_id)
    await updateOrderStatus(order.order_id, order.shop_domain, nextStatus)
    setOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, status: nextStatus } : o))
    setUpdatingId(null)
  }

  const filteredOrders = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    const matchSearch = !search || (o.order_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.shop_domain || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.email || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const stats = {
    total: orders.length,
    queued: orders.filter(o => o.status === 'queued').length,
    printing: orders.filter(o => o.status === 'printing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    stores: stores.length,
  }

  const NAV = [
    { id: 'orders', label: 'Orders' },
    { id: 'stores', label: 'Stores' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F9F9F7' }}>
      {/* Header */}
      <div style={{ background: '#0A0A0A', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>No Limit Studio Admin</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setActiveTab(n.id)}
                style={{ background: activeTab === n.id ? '#fff' : 'transparent', color: activeTab === n.id ? '#0A0A0A' : '#9CA3AF', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                {n.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>{user.email}</span>
          <button onClick={() => signOut(auth)}
            style={{ background: '#1F2937', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total Orders', value: stats.total, color: '#0A0A0A' },
            { label: 'Queued', value: stats.queued, color: '#854D0E' },
            { label: 'Printing', value: stats.printing, color: '#1E40AF' },
            { label: 'Shipped', value: stats.shipped, color: '#065F46' },
            { label: 'Active Stores', value: stats.stores, color: '#0A0A0A' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders, stores, customers..."
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '6px' }}>
                {['all', 'queued', 'printing', 'shipped', 'delivered'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    style={{ background: filterStatus === s ? '#0A0A0A' : '#F3F4F6', color: filterStatus === s ? '#fff' : '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {s === 'all' ? 'All' : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <button onClick={loadData} style={{ background: '#F3F4F6', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>No orders found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Order', 'Store', 'Customer', 'Items', 'Amount', 'Status', 'Date', 'Action'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o, i) => {
                    const next = STATUS_NEXT[o.status]
                    return (
                      <tr key={o.order_id || i} style={{ borderTop: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600 }}>{o.order_name || `#${o.order_id}`}</td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#6B7280' }}>{(o.shop_domain || '').replace('.myshopify.com', '')}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px' }}>{o.email || '—'}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>{(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600 }}>{o.currency || 'INR'} {parseFloat(o.total_price || 0).toFixed(2)}</td>
                        <td style={{ padding: '14px 16px' }}><Badge status={o.status} /></td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9CA3AF' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                        <td style={{ padding: '14px 16px' }}>
                          {next && (
                            <button onClick={() => handleStatusChange(o, next)} disabled={updatingId === o.order_id}
                              style={{ background: '#0A0A0A', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: updatingId === o.order_id ? 0.5 : 1 }}>
                              {updatingId === o.order_id ? '...' : `Mark ${STATUS_LABEL[next]}`}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Stores Tab */}
        {activeTab === 'stores' && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>Connected Stores ({stores.length})</span>
            </div>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>Loading stores...</div>
            ) : stores.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>No stores connected yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Store', 'Plan', 'Installed At'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s, i) => (
                    <tr key={s.shop_domain || i} style={{ borderTop: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600 }}>{s.shop_domain}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: s.current_plan && s.current_plan !== 'free' ? '#D1FAE5' : '#F3F4F6', color: s.current_plan && s.current_plan !== 'free' ? '#065F46' : '#374151', padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>
                          {s.current_plan || 'free'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>{s.installed_at ? new Date(s.installed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, u => { setUser(u); setChecking(false) })
  }, [])

  if (checking) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#9CA3AF' }}>Loading...</div>
  if (!user || !ALLOWED_EMAILS.includes(user.email)) return <LoginPage />
  return <AdminDashboard user={user} />
}
