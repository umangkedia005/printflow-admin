const BASE_URL = import.meta.env.VITE_API_URL

export async function fetchAllOrders() {
  const res = await fetch(`${BASE_URL}/admin/orders`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchAllStores() {
  const res = await fetch(`${BASE_URL}/admin/stores`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function updateOrderStatus(orderId, shop, status) {
  const res = await fetch(`${BASE_URL}/admin/order-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, shop_domain: shop, status }),
  })
  return res.json()
}
