const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`)
  }
  return res.json()
}

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

export async function uploadCSV(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/upload-csv`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}
