const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------
export async function fetchAPI(endpoint: string, options?: RequestInit) {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    if (!res.ok) {
      let detail = `API Error: ${res.status}`
      try {
        const body = await res.json()
        detail = body.detail || detail
      } catch (_) {}
      throw new Error(detail)
    }
    return res.json()
  } catch (err: any) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error('Backend server is offline or unreachable. Please start the backend server on port 8000.')
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Health / status
// ---------------------------------------------------------------------------
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL.replace('/api', '')}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch (_) {
    return false
  }
}

export async function getUploadStatus() {
  try {
    return await fetchAPI('/upload-status')
  } catch (_) {
    return { has_data: false, active: false, filename: '', rows: 0, columns: [], rag_ready: false }
  }
}

// ---------------------------------------------------------------------------
// File upload & session management (CSV + XML)
// ---------------------------------------------------------------------------
export async function startSession(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch(`${API_URL}/start-session`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      let errorDetail = `Server error (${res.status})`
      try {
        const errorJson = await res.json()
        errorDetail = errorJson.detail || errorDetail
      } catch (_) {}
      throw new Error(errorDetail)
    }

    return res.json()
  } catch (err: any) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error('Could not connect to backend server (http://localhost:8000). Please start backend with: python -m uvicorn main:app --reload')
    }
    throw err
  }
}

export async function endSession() {
  const res = await fetch(`${API_URL}/end-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Failed to end session (${res.status})`)
  }
  return res.json()
}

export async function uploadFile(file: File) {
  return startSession(file)
}

/** @deprecated use startSession */
export const uploadCSV = startSession

// ---------------------------------------------------------------------------
// Data Explorer Endpoints
// ---------------------------------------------------------------------------
export async function getDatasetRows(page = 1, limit = 50, search = '') {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), search }).toString()
  return fetchAPI(`/dataset/rows?${params}`)
}

export async function getDatasetSchema() {
  return fetchAPI('/dataset/schema')
}

// ---------------------------------------------------------------------------
// Data endpoints
// ---------------------------------------------------------------------------
export async function getKPIs(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {}).toString()
  return fetchAPI(`/kpis${params ? '?' + params : ''}`)
}

export async function getRevenueByLocation(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {}).toString()
  return fetchAPI(`/revenue-by-location${params ? '?' + params : ''}`)
}

export async function getRevenueByCuisine(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {}).toString()
  return fetchAPI(`/revenue-by-cuisine${params ? '?' + params : ''}`)
}

export async function getRevenueTrend(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {}).toString()
  return fetchAPI(`/revenue-trend${params ? '?' + params : ''}`)
}

export async function getTopEntities(limit = 10, filters?: Record<string, string>) {
  const params = new URLSearchParams({ limit: String(limit), ...filters }).toString()
  return fetchAPI(`/top-entities?${params}`)
}

export async function getFilterOptions() {
  return fetchAPI('/filters/options')
}

export async function getCorrelation() {
  return fetchAPI('/correlation')
}

export async function getDrivers() {
  return fetchAPI('/drivers')
}

export async function getSeasonalPatterns() {
  return fetchAPI('/seasonal-patterns')
}

export async function getForecast(periods = 6) {
  return fetchAPI(`/forecast?periods=${periods}`)
}

export async function chatQuery(message: string, history: Array<{role: string, content: string}>) {
  return fetchAPI('/chat-query', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  })
}

export async function getAlerts() {
  return fetchAPI('/alerts')
}

// ---------------------------------------------------------------------------
// Streaming Chat (SSE)
// ---------------------------------------------------------------------------
export async function chatStream(
  message: string,
  history: Array<{role: string, content: string}>,
  onToken: (token: string) => void,
  onDone: (source: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/chat-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    })

    if (!res.ok) {
      throw new Error(`Stream failed: ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No readable stream')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const data = JSON.parse(trimmed.slice(6))
          if (data.token) {
            onToken(data.token)
          }
          if (data.done) {
            onDone(data.source || 'unknown')
          }
        } catch {
          // Skip malformed events
        }
      }
    }
  } catch (err: any) {
    onError(err.message || 'Streaming failed')
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}
