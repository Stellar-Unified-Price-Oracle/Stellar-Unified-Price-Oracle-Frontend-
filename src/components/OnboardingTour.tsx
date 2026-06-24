import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'onboarding-tour-dismissed'

export interface TourStep {
  id: string
  title: string
  description: string
  /** CSS selector for the element to highlight */
  targetSelector?: string
}

const DEFAULT_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Stellar Oracle',
    description:
      'This dashboard aggregates real-time price feeds from Chainlink, Redstone, Band, and Reflector oracles into a single, unified view.',
  },
  {
    id: 'price-cards',
    title: 'Price Cards',
    description:
      'Each card shows live prices for an asset pair. Right-click any card or use the ⋮ menu for quick actions like setting alerts, exporting data, and more.',
    targetSelector: '[aria-label="Price feeds"]',
  },
  {
    id: 'connection-badge',
    title: 'WebSocket Connection',
    description:
      'The connection badge shows the real-time WebSocket status. A green dot means prices are updating live. If it goes orange or red, prices may be delayed.',
    targetSelector: '[aria-label^="WebSocket"]',
  },
  {
    id: 'confidence',
    title: 'Confidence Score',
    description:
      'The confidence score (e.g. 98.8%) reflects how many oracle sources agreed on the price. Higher scores mean stronger consensus across Chainlink, Redstone, Band & Reflector.',
  },
  {
    id: 'alerts',
    title: 'Price Alerts',
    description:
      'Click the bell icon to set upper/lower price thresholds. You\'ll receive a browser notification when an asset crosses your alert price.',
    targetSelector: '[aria-label="Toggle price alerts"]',
  },
]

interface OnboardingContextValue {
  isDismissed: boolean
  isActive: boolean
  startTour: () => void
  dismissTour: () => void
  currentStep: number
  steps: TourStep[]
  goToStep: (index: number) => void
  next: () => void
  prev: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  // Auto-start for first-time visitors
  useEffect(() => {
    if (!isDismissed) {
      // Small delay so the page renders first
      const t = setTimeout(() => setIsActive(true), 800)
      return () => clearTimeout(t)
    }
  }, [isDismissed])

  const startTour = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const dismissTour = useCallback(() => {
    setIsActive(false)
    setIsDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  const next = useCallback(() => {
    if (currentStep < DEFAULT_STEPS.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      dismissTour()
    }
  }, [currentStep, dismissTour])

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1))
  }, [])

  const goToStep = useCallback((index: number) => {
    setCurrentStep(Math.max(0, Math.min(DEFAULT_STEPS.length - 1, index)))
  }, [])

  return (
    <OnboardingContext.Provider
      value={{
        isDismissed,
        isActive,
        startTour,
        dismissTour,
        currentStep,
        steps: DEFAULT_STEPS,
        goToStep,
        next,
        prev,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider')
  return ctx
}

function TourOverlay() {
  const { isActive, steps, currentStep, next, prev, dismissTour } = useOnboarding()

  const step = steps[currentStep]

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') dismissTour()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isActive, next, prev, dismissTour])

  // Highlight target element
  const [highlight, setHighlight] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!isActive || !step?.targetSelector) {
      setHighlight(null)
      return
    }
    const el = document.querySelector(step.targetSelector)
    if (el) {
      setHighlight(el.getBoundingClientRect())
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      setHighlight(null)
    }
  }, [isActive, step])

  if (!isActive || !step) return null

  return createPortal(
    <div className="fixed inset-0 z-[9990] pointer-events-none">
      {/* Dimmed backdrop with highlight cutout */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={dismissTour} />

      {/* Highlight ring */}
      {highlight && (
        <div
          className="absolute pointer-events-none rounded-xl ring-2 ring-cyan-400 ring-offset-2 ring-offset-transparent transition-all duration-300"
          style={{
            top: highlight.top - 4,
            left: highlight.left - 4,
            width: highlight.width + 8,
            height: highlight.height + 8,
          }}
        />
      )}

      {/* Tour card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding step ${currentStep + 1} of ${steps.length}: ${step.title}`}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm bg-gray-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-5 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-3" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? 'w-5 bg-cyan-400' : 'w-1.5 bg-gray-700'
              }`}
            />
          ))}
          <span className="ml-auto text-xs text-gray-500">
            {currentStep + 1}/{steps.length}
          </span>
        </div>

        <h3 className="text-base font-semibold text-white mb-1.5">{step.title}</h3>
        <p className="text-sm text-gray-400 mb-4 leading-relaxed">{step.description}</p>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={dismissTour}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={prev}
                className="px-3 py-1.5 text-sm text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="px-4 py-1.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function OnboardingTourOverlay() {
  return <TourOverlay />
}
