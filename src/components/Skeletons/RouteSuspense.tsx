import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

const MIN_SKELETON_MS = 200

const RouteLoadContext = createContext<number>(Date.now())

function EnsureMinSkeletonTime({
  children,
  placeholder,
  minMs,
}: {
  children: ReactNode
  placeholder: ReactNode
  minMs: number
}): ReactElement {
  const loadStartedAt = useContext(RouteLoadContext)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const remaining = minMs - (Date.now() - loadStartedAt)
    const timer = window.setTimeout(() => setReady(true), Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [loadStartedAt, minMs])

  if (!ready) return <>{placeholder}</>
  return <>{children}</>
}

interface RouteSuspenseProps {
  fallback: ReactNode
  children: ReactNode
}

export function RouteSuspense({ fallback, children }: RouteSuspenseProps): ReactElement {
  const loadStartedAt = useRef(Date.now())

  return (
    <RouteLoadContext.Provider value={loadStartedAt.current}>
      <Suspense fallback={fallback}>
        <EnsureMinSkeletonTime placeholder={fallback} minMs={MIN_SKELETON_MS}>
          {children}
        </EnsureMinSkeletonTime>
      </Suspense>
    </RouteLoadContext.Provider>
  )
}
