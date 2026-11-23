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

// tracking ({ courier, number, url }) is only sent with "shipped".
export async function updateOrderStatus(orderId, shop, status, tracking = null) {
  const res = await fetch(`${BASE_URL}/admin/order-status`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify({ order_id: orderId, shop_domain: shop, status, ...(tracking ? { tracking } : {}) }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not update the order')
  return data
}

export async function fetchProductMappings(shop) {
  const res = await fetch(`${BASE_URL}/admin/product-mappings?shop=${encodeURIComponent(shop)}`, { headers: await adminHeaders() })
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function updateProductMapping({ shop, shopifyProductId, factorySku, fulfillmentCost }) {
  const res = await fetch(`${BASE_URL}/admin/product-mappings`, {
    method: 'POST',
    headers: await adminHeaders(true),
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

// Presigned POST straight to S3, like the merchant artwork uploads. Gives up
// after a minute instead of leaving the page waiting forever.
export async function uploadBlankPhoto(blankId, photo) {
  const res = await fetch(`${BASE_URL}/admin/uploads/blank-image`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify({ blank_id: blankId, content_type: photo.type }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not start the upload')

  const form = new FormData()
  Object.entries(data.fields).forEach(([k, v]) => form.append(k, v))
  form.append('file', photo, 'photo.jpg')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  let upload
  try {
    upload = await fetch(data.url, { method: 'POST', body: form, signal: controller.signal })
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'Upload timed out. Check your connection and try again.' : 'Could not reach storage. Try again.')
  } finally {
    clearTimeout(timer)
  }
  if (!upload.ok) {
    const detail = (await upload.text()).match(/<Message>(.*?)<\/Message>/)?.[1]
    throw new Error(`Upload failed${detail ? `: ${detail}` : ''}.`)
  }
  return data.key
}

// Pieces on hand per colour / size; '' = not counted.
export async function saveStock(blankId, stock) {
  const res = await fetch(`${BASE_URL}/admin/stock`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify({ blank_id: blankId, stock }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save stock')
  return data
}

// Branding (hang tags, courier bags): prices, artwork review, brand stock.
async function adminCall(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, body === undefined
    ? { headers: await adminHeaders() }
    : { method: 'POST', headers: await adminHeaders(true), body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
export const fetchBrandingAdmin = () => adminCall('/admin/branding')
export const saveBrandingCatalog = products => adminCall('/admin/branding/catalog', { products })
export const reviewBrandingOrder = (email, orderId, status, reason) => adminCall('/admin/branding/review', { email, order_id: orderId, status, reason })
export const setBrandingStock = (email, product, left) => adminCall('/admin/branding/stock', { email, product, left })

// Invoices: the business details printed on every invoice, and opening one.
export const fetchInvoiceSettings = () => adminCall('/admin/invoice-settings')
export const saveInvoiceSettings = values => adminCall('/admin/invoice-settings', values)
// Enquiries from the dashboard's Bulk & Custom page.
export const fetchEnquiries = () => adminCall('/admin/enquiries')
// Cash on delivery: remittances from ProShip, payouts to brands, returns.
export const fetchCod = () => adminCall('/admin/cod')
export const markCodRemitted = (orderIds, date, utr) => adminCall('/admin/cod/remitted', { order_ids: orderIds, date, utr })
export const payOutCod = (email, orderIds, date, utr) => adminCall('/admin/cod/payout', { email, order_ids: orderIds, date, utr })
export const markRto = orderId => adminCall('/admin/rto', { order_id: orderId })
export const updateEnquiry = (enquiryId, status, note) => adminCall('/admin/enquiries/update', { enquiry_id: enquiryId, status, note })
export const fetchAdminInvoice = (kind, id) => adminCall(`/admin/invoice?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`)

// Opens an invoice in a new tab (opened before the request, so pop-up
// blockers allow it); its button prints or saves it as a PDF.
export async function openInvoice(kind, id) {
  const win = window.open('', '_blank')
  try {
    const { html } = await fetchAdminInvoice(kind, id)
    win.document.open(); win.document.write(html); win.document.close()
  } catch (e) {
    win.close()
    throw e
  }
}

// The invoice exactly as issued, for a customer who was erased. Each opening
// is recorded with who, when and why.
export async function openTaxCopy(kind, id, reason) {
  const win = window.open('', '_blank')
  try {
    const { html } = await adminCall('/admin/invoice/tax-copy', { kind, id, reason })
    win.document.open(); win.document.write(html); win.document.close()
  } catch (e) {
    win.close()
    throw e
  }
}

export async function fetchSettings() {
  const res = await fetch(`${BASE_URL}/admin/settings`, { headers: await adminHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load settings')
  return data
}

export async function saveSettings(values) {
  const res = await fetch(`${BASE_URL}/admin/settings`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify(values),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save settings')
  return data
}

// Customers' own garments (My garments), for review.
export async function fetchGarmentsAdmin() {
  const res = await fetch(`${BASE_URL}/admin/garments`, { headers: await adminHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not load garments')
  return Array.isArray(data) ? data : []
}

// decision: 'approve' (with adjusted areas) or 'reject' (with a note).
export async function reviewGarment(review) {
  const res = await fetch(`${BASE_URL}/admin/garments/review`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify(review),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not save the review')
  return data
}

export async function fetchGarmentCosts() {
  const res = await fetch(`${BASE_URL}/admin/garment-costs`, { headers: await adminHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not load garment print costs')
  return data
}

export async function saveGarmentCosts(costs) {
  const res = await fetch(`${BASE_URL}/admin/garment-costs`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify(costs),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not save garment print costs')
  return data
}

// An account's wallet balance and linked stores.
export async function fetchAccountWallet(email) {
  const res = await fetch(`${BASE_URL}/admin/wallet?email=${encodeURIComponent(email)}`, { headers: await adminHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not look up that account')
  return data
}

// Add money to an account's wallet (test credit, refund, goodwill).
export async function creditWallet(email, amount, note) {
  const res = await fetch(`${BASE_URL}/admin/wallet-credit`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify({ email, amount, note }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not add the credit')
  return data
}

// App Review mode for the login given to Shopify's reviewers.
export const setReviewMode = (email, on) => adminCall('/admin/review-mode', { email, on })

// Detach a store from its account so another account can link it.
export async function unlinkStore(shop) {
  const res = await fetch(`${BASE_URL}/admin/stores/unlink`, {
    method: 'POST',
    headers: await adminHeaders(true),
    body: JSON.stringify({ shop_domain: shop }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not unlink the store')
  return data
}
