import { useCallback, useEffect, useRef, useState } from 'react'

export function useAction<T, Args extends unknown[]>(
  operation: (...args: [...Args, AbortSignal]) => Promise<T>,
) {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)

  useEffect(() => () => active.current?.abort(), [])

  const reset = useCallback(() => {
    active.current?.abort()
    active.current = null
    setData(undefined)
    setError(null)
    setLoading(false)
  }, [])

  const run = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      active.current?.abort()
      const controller = new AbortController()
      active.current = controller
      setLoading(true)
      setError(null)
      try {
        const result = await operation(...args, controller.signal)
        if (controller.signal.aborted) return undefined
        setData(result)
        return result
      } catch (err) {
        if (!controller.signal.aborted) {
          setData(undefined)
          setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
        }
        return undefined
      } finally {
        if (active.current === controller) setLoading(false)
      }
    },
    [operation],
  )

  return { data, loading, error, run, reset, setData }
}

export function useCopy() {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async (text: string) => {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('error')
    }
    timer.current = setTimeout(() => setState('idle'), 3500)
  }
  return { state, copy }
}
