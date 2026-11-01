import type {
  ChatMessage,
  Classification,
  Health,
  OrderExtraction,
  ReplyDraft,
  Task,
  TaskBatchResult,
  TaskInput,
  TaskStatus,
  Tone,
} from './types'

// Same-origin by default: Vite proxies requests to the backend, including hosted previews.
const API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = new AbortController()
  const timer = window.setTimeout(() => timeout.abort(), 30_000)
  const onAbort = () => timeout.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted) timeout.abort()
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      signal: timeout.signal,
    })
    if (response.status === 204) return undefined as T
    let data: unknown
    try {
      data = await response.json()
    } catch {
      if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
      throw new ApiError(
        'The server returned an unreadable response. Check that the API is running.',
        response.status,
      )
    }
    if (!response.ok) {
      const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : null
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail.length && typeof detail[0]?.msg === 'string'
            ? detail[0].msg
            : `The request could not be completed (${response.status}). Please try again.`
      throw new ApiError(message, response.status)
    }
    return data as T
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (error instanceof ApiError) throw error
    if (timeout.signal.aborted) throw new ApiError('The server took too long to respond. Please try again.')
    throw new ApiError(
      'Cannot reach the API. Check your connection and that the backend is running, then retry.',
    )
  } finally {
    window.clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body), signal })
}

export const api = {
  health: (signal?: AbortSignal) => request<Health>('/health', { signal }),
  classify: (message: string, signal?: AbortSignal) =>
    post<Classification>('/api/classify', { message }, signal),
  draft: (message: string, tone: Tone, businessName: string, signal?: AbortSignal) =>
    post<ReplyDraft>('/api/replies', { message, tone, business_name: businessName }, signal),
  extractOrder: (message: string, signal?: AbortSignal) =>
    post<OrderExtraction>('/api/orders/extract', { message }, signal),
  tasks: (signal?: AbortSignal) => request<Task[]>('/api/tasks', { signal }),
  createTasks: (tasks: TaskInput[], signal?: AbortSignal) =>
    post<TaskBatchResult>('/api/tasks', { tasks }, signal),
  updateTask: (id: string, status: TaskStatus, signal?: AbortSignal) =>
    request<Task>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      signal,
    }),
  deleteTask: (id: string, signal?: AbortSignal) =>
    request<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  chat: (message: string, history: ChatMessage[], signal?: AbortSignal) =>
    post<{ reply: string; engine: 'groq' }>('/api/chat', { message, history }, signal),
}
