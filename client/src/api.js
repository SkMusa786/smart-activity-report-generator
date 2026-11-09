const configuredApiUrl = import.meta.env.VITE_API_URL
if (!configuredApiUrl && import.meta.env.PROD) {
  throw new Error('VITE_API_URL is required in the production frontend environment.')
}
const API_URL = (configuredApiUrl || 'http://localhost:5000').replace(/\/$/, '')

async function request(url, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server timed out. Please try again.', { cause: error })
    throw new Error('Unable to reach the backend. Check that the server is running.', { cause: error })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'The server could not process the request.')
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
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || `Unable to generate ${format.toUpperCase()} report.`)
  }
  return response.blob()
}

export async function submitReport(report) {
  const data = await parseResponse(await request(`${API_URL}/api/reports/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  }))
  return data
}
