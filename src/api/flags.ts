import { config } from '../config'
import type { FeatureFlag } from '../features/types'

async function request<T>(path: string): Promise<T> {
  const url = `${config.apiUrl}${path}`
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  return request<FeatureFlag[]>('/api/flags')
}