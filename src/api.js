import { auth } from './firebase'

const BASE_URL = import.meta.env.VITE_API_URL

// Every /admin/ route checks the signed-in Google account against the
// backend's admin list, so send its Firebase ID token with each call.
async function adminHeaders(json = false) {
  const token = await auth.currentUser?.getIdToken()
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function fetchAllOrders() {
  const res = await fetch(`${BASE_URL}/admin/orders`, { headers: await adminHeaders() })
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchAllStores() {
  const res = await fetch(`${BASE_URL}/admin/stores`, { headers: await adminHeaders() })
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function updateOrderStatus(orderId, shop, status) {
  const res = await fetch(`${BASE_URL}/admin/order-status`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify({ order_id: orderId, shop_domain: shop, status }),
  })
  return res.json()
}

export async function fetchProductMappings(shop) {
  const res = await fetch(`${BASE_URL}/product-mappings?shop=${encodeURIComponent(shop)}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function updateProductMapping({ shop, shopifyProductId, factorySku, fulfillmentCost }) {
  const res = await fetch(`${BASE_URL}/product-mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shop,
      shopify_product_id: shopifyProductId,
      factory_sku: factorySku,
      fulfillment_cost: fulfillmentCost,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update product')
  return data
}

export async function fetchBlanks() {
  const res = await fetch(`${BASE_URL}/admin/blanks`, { headers: await adminHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load the catalogue')
  return Array.isArray(data) ? data : []
}

export async function saveBlank(blank) {
  const res = await fetch(`${BASE_URL}/admin/blanks`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify(blank),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save the product')
  return data
}

// Presigned POST straight to S3, like the merchant artwork uploads.
export async function uploadBlankPhoto(blankId, file) {
  const res = await fetch(`${BASE_URL}/admin/uploads/blank-image`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify({ blank_id: blankId, content_type: file.type }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not start the upload')
  const form = new FormData()
  Object.entries(data.fields).forEach(([k, v]) => form.append(k, v))
  form.append('file', file)
  const upload = await fetch(data.url, { method: 'POST', body: form })
  if (!upload.ok) throw new Error('Upload failed. Photos must be PNG, JPG or WebP and under 10 MB.')
  return data.key
}
