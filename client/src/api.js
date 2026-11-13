const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const API_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/$/, '')
  : ''

function getApiConfigurationError() {
  if (import.meta.env.DEV && !API_URL) {
    return 'API is not configured. Set VITE_API_BASE_URL to the local backend URL and restart the frontend.'
  }
  if (import.meta.env.PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(API_URL)) {
    return 'The production frontend is configured with a localhost API URL. Set VITE_API_BASE_URL to the public backend URL in Vercel and redeploy.'
  }
  return null
}

async function request(url, options = {}, timeoutMs = 60_000) {
  const configurationError = getApiConfigurationError()
  if (configurationError) throw new Error(configurationError)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error instanceof TypeError && API_URL && !navigator.onLine) {
      throw new Error('The browser is offline. Reconnect and try again.', { cause: error })
    }
    if (error.name === 'AbortError') throw new Error('The server timed out. Please try again.', { cause: error })
    throw new Error(`Unable to reach the backend at ${url || window.location.origin}. Check VITE_API_BASE_URL, that the backend is running, and that FRONTEND_URL allows this frontend.`, { cause: error })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function responseError(response, fallback) {
  const data = await response.json().catch(() => ({}))
  return new Error(data.message || `${fallback} (HTTP ${response.status}).`)
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `The server could not process the request (HTTP ${response.status}).`)
  }
  return data
}

export async function describeBatch(files) {
  const body = new FormData()
  files.forEach((file) => body.append('images', file))
  const data = await parseResponse(await request(`${API_URL}/api/activities/describe-batch`, { method: 'POST', body }))
  return data.results || []
}

export async function describeSingle(file) {
  const body = new FormData()
  body.append('image', file)
  const data = await parseResponse(await request(`${API_URL}/api/activities/describe`, { method: 'POST', body }))
  return data.description
}

export async function generateReport(report, format) {
  const response = await request(`${API_URL}/api/reports/generate/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  }, 180_000)
  if (!response.ok) {
    throw await responseError(response, `Unable to generate ${format.toUpperCase()} report`)
  }
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim()
  const expectedTypes = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  if (contentType !== expectedTypes[format]) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `The server returned an invalid ${format.toUpperCase()} document.`)
  }
  const data = await response.blob()
  if (!data.size) {
    throw new Error(`The server returned an empty ${format.toUpperCase()} document.`)
  }
  const disposition = response.headers.get('content-disposition') || ''
  const filenameMatch = disposition.match(/filename="([^"]+)"/i)
  return {
    blob: new Blob([data], { type: expectedTypes[format] }),
    filename: filenameMatch?.[1] || `social-service-activity-report.${format}`,
  }
}

export async function submitReport(report) {
  const data = await parseResponse(await request(`${API_URL}/api/reports/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  }, 120_000))
  return data
}
