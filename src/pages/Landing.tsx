import { useNavigate } from 'react-router-dom'
import { usePriceContext } from '../context/PriceContext'
import { LandingHero } from '../components/LandingHero'

/**
 * Landing page (route: `/`).
 *
 * Shows the {@link LandingHero} market overview so new users get context before
 * entering the full dashboard. The hero's "Open Dashboard" CTA navigates to `/dashboard`.
 */
export function Landing() {
  const { prices, pricesLoading } = usePriceContext()
  const navigate = useNavigate()

  return (
    <div>
      <LandingHero
        prices={prices}
        loading={pricesLoading}
        onEnterDashboard={() => navigate('/dashboard')}
      />
    </div>
  )
}
