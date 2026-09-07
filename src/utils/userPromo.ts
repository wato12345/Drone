const LEGACY_USER_CUTOFF = new Date('2026-07-18T00:00:00')

export function isLegacyUser(createdAt: string): boolean {
  const registeredAt = new Date(createdAt)
  return !Number.isNaN(registeredAt.getTime()) && registeredAt < LEGACY_USER_CUTOFF
}

export const PROMO_ADS = [
  {
    title: 'Low-Altitude Flight Insurance — Limited Offer',
    body: 'Legacy users: 20% off your first year, covering urban route flights around the clock.',
    cta: 'Learn more',
  },
  {
    title: 'Drone Battery Trade-In Program',
    body: 'Users registered before 2026-07-18 get smart battery replacement subsidies for longer endurance.',
    cta: 'View offer',
  },
  {
    title: 'Route Planner Pro Membership',
    body: 'Upgrade to Pro for extra avoidance layers, saved routes, and export tools — 7-day trial.',
    cta: 'Start free trial',
  },
  {
    title: 'Urban Aerial Map Pack',
    body: 'New HD 3D buildings and no-fly zone data — legacy users save $30 on download.',
    cta: 'Shop now',
  },
  {
    title: 'Flight Safety Training Course',
    body: 'Online certification now open; complete the course to earn an official safety badge.',
    cta: 'Enroll now',
  },
] as const

export function pickRandomPromoAd() {
  return PROMO_ADS[Math.floor(Math.random() * PROMO_ADS.length)]
}
