const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export interface GeocodeResult {
  name: string
  displayName: string
}

export interface PlaceSearchResult {
  name: string
  displayName: string
  lng: number
  lat: number
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Request failed'
    throw new Error(message)
  }
  return data as T
}

export async function fetchReverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  })
  const response = await fetch(`${API_BASE}/geocode/reverse?${params}`)
  return parseJson<GeocodeResult>(response)
}

export async function fetchPlaceSearch(query: string): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`${API_BASE}/geocode/search?${params}`)
  const data = await parseJson<{ results: PlaceSearchResult[] }>(response)
  return Array.isArray(data.results) ? data.results : []
}
