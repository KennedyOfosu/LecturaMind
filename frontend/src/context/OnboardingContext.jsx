import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_PENDING = 'lm_onboarding_pending'
const STORAGE_COMPLETED = 'lm_onboarding_completed'
const STORAGE_STEP = 'lm_onboarding_step'

const OnboardingContext = createContext(null)

export function OnboardingProvider({ children }) {
  const [active, setActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const recheckOnboarding = useCallback(() => {
    const pending = localStorage.getItem(STORAGE_PENDING) === 'true'
    const completed = localStorage.getItem(STORAGE_COMPLETED) === 'true'
    if (pending && !completed) {
      const savedStep = parseInt(localStorage.getItem(STORAGE_STEP) || '0', 10)
      setCurrentStep(savedStep)
      setActive(true)
    }
  }, [])

  const startOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_PENDING, 'true')
    localStorage.removeItem(STORAGE_COMPLETED)
    localStorage.setItem(STORAGE_STEP, '0')
    setCurrentStep(0)
    setActive(true)
  }, [])

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1
      localStorage.setItem(STORAGE_STEP, String(next))
      return next
    })
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(0, prev - 1)
      localStorage.setItem(STORAGE_STEP, String(next))
      return next
    })
  }, [])

  const skipOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_COMPLETED, 'true')
    localStorage.removeItem(STORAGE_PENDING)
    localStorage.removeItem(STORAGE_STEP)
    setActive(false)
    setCurrentStep(0)
  }, [])

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_COMPLETED, 'true')
    localStorage.removeItem(STORAGE_PENDING)
    localStorage.removeItem(STORAGE_STEP)
    setActive(false)
    setCurrentStep(0)
  }, [])

  return (
    <OnboardingContext.Provider
      value={{
        isActive: active,
        currentStep,
        totalSteps: 6,
        recheckOnboarding,
        startOnboarding,
        nextStep,
        prevStep,
        skipOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}
