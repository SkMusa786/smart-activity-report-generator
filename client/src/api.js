const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_URL = configuredApiUrl?.replace(/\/$/, '')

async function request(url, options = {}, timeoutMs = 60_000) {
  if (!API_URL) {
    throw new Error('API is not configured. Set VITE_API_URL and restart the frontend.')
  }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server timed out. Please try again.', { cause: error })
    throw new Error(`Unable to reach the backend at ${url}. Check that the backend is running and that CORS allows this frontend.`, { cause: error })
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
  return response.blob()
}

export async function submitReport(report) {
  const data = await parseResponse(await request(`${API_URL}/api/reports/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  }, 120_000))
  return data
}
