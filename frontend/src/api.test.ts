import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

afterEach(() => vi.unstubAllGlobals())

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('API client', () => {
  it('uses relative URLs, not localhost, and sends JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ reply: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)
    await api.chat('Hello', [])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ message: 'Hello', history: [] }) }),
    )
  })

  it('surfaces backend error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ detail: 'Add GROQ_API_KEY to enable chat.' }, 503)),
    )
    await expect(api.chat('Hello', [])).rejects.toThrow('Add GROQ_API_KEY to enable chat.')
  })

  it('handles validation error arrays', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ detail: [{ msg: 'Message is required.' }] }, 422)),
    )
    await expect(api.classify('')).rejects.toThrow('Message is required.')
  })

  it('reports invalid JSON without pretending the request succeeded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    )
    await expect(api.health()).rejects.toThrow('unreadable response')
  })

  it('reports network failure clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.tasks()).rejects.toThrow('Cannot reach the API')
  })

  it('accepts empty deletion responses and encodes task IDs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.deleteTask('a/b')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/a%2Fb', expect.objectContaining({ method: 'DELETE' }))
  })

  it('preserves caller cancellation', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )
    const pending = api.tasks(controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('times out stalled requests', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )
    const pending = api.health()
    const assertion = expect(pending).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    vi.useRealTimers()
  })
})
