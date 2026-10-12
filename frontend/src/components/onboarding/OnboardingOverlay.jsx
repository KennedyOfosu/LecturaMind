import { useEffect, useState, useCallback } from 'react'
import { useOnboarding } from '../../context/OnboardingContext'
import { useAuth } from '../../hooks/useAuth'
import { studentSteps, lecturerSteps } from './guideSteps'

export default function OnboardingOverlay() {
  const { user } = useAuth()
  const {
    isActive,
    currentStep,
    totalSteps,
    recheckOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
  } = useOnboarding()

  const [targetRect, setTargetRect] = useState(null)

  const steps = user?.role === 'lecturer' ? lecturerSteps : studentSteps
  const step = steps[currentStep]

  const recalcTarget = useCallback(() => {
    if (!step || step.centered || !step.targetSelector) {
      setTargetRect(null)
      return
    }
    const el = document.querySelector(step.targetSelector)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
    } else {
      setTargetRect(null)
    }
  }, [step])

  useEffect(() => {
    recheckOnboarding()
  }, [recheckOnboarding])

  useEffect(() => {
    recalcTarget()
    if (!step || step.centered) return

    const handle = () => recalcTarget()
    window.addEventListener('scroll', handle, true)
    window.addEventListener('resize', handle)
    return () => {
      window.removeEventListener('scroll', handle, true)
      window.removeEventListener('resize', handle)
    }
  }, [recalcTarget, step])

  if (!isActive || !step) return null

  const isLast = step.isLast || currentStep === steps.length - 1
  const progress = ((currentStep + 1) / steps.length) * 100

  const tooltipWidth = 320
  const tooltipGap = 16

  const getTooltipStyle = () => {
    if (!targetRect) return {}
    const preferred = step.tooltipPosition || 'right'

    if (preferred === 'right') {
      let left = targetRect.right + tooltipGap
      let top = targetRect.top - 10
      if (left + tooltipWidth > window.innerWidth - 16) {
        left = Math.max(16, targetRect.left - tooltipWidth - tooltipGap)
      }
      if (top < 16) top = 16
      if (top + 300 > window.innerHeight) top = window.innerHeight - 316
      return { left, top }
    }

    return {
      left: Math.max(16, targetRect.left),
      top: targetRect.bottom + tooltipGap,
    }
  }

  const renderTooltip = () => (
    <div
      className="absolute bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
      style={{ width: tooltipWidth, ...getTooltipStyle() }}
    >
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gray-900 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="px-6 py-5">
        <div className="text-3xl mb-3">{step.icon}</div>
        <h3 className="text-base font-bold text-gray-900 mb-2">{step.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.description}</p>
        <p className="text-xs text-gray-400 mb-4">
          Step {currentStep + 1} of {steps.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={skipOnboarding}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors px-2 py-1.5"
          >
            Skip
          </button>
          <div className="flex-1" />
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? completeOnboarding : nextStep}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderCentered = () => (
    <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-[onboardingFadeIn_0.3s_ease-out]">
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gray-900 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="px-8 py-8">
        <div className="text-5xl mb-5 text-center">{step.icon}</div>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-3">{step.title}</h2>
        <p className="text-sm text-gray-600 text-center leading-relaxed mb-4">{step.description}</p>
        <p className="text-xs text-gray-400 text-center mb-5">
          Step {currentStep + 1} of {steps.length}
        </p>
        <div className="flex items-center gap-3">
          {!isLast ? (
            <>
              <button onClick={skipOnboarding} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors px-3 py-2">
                Skip Tour
              </button>
              <div className="flex-1" />
              {currentStep > 0 && (
                <button onClick={prevStep} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Back
                </button>
              )}
              <button onClick={nextStep} className="px-5 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors">
                Next
              </button>
            </>
          ) : (
            <>
              <div className="flex-1" />
              <button onClick={completeOnboarding} className="px-6 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors">
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[10000]">
      {step.centered ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          {renderCentered()}
        </div>
      ) : (
        <>
          {/* Backdrop with spotlight cutout */}
          {targetRect && (
            <>
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: targetRect.top }} />
              <div className="absolute bg-black/50" style={{ top: targetRect.bottom, left: 0, right: 0, bottom: 0 }} />
              <div className="absolute bg-black/50" style={{ top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height }} />
              <div className="absolute bg-black/50" style={{ top: targetRect.top, left: targetRect.right, right: 0, height: targetRect.height }} />

              {/* Highlight ring */}
              <div
                className="absolute rounded-lg pointer-events-none"
                style={{
                  left: targetRect.left - 3,
                  top: targetRect.top - 3,
                  width: targetRect.width + 6,
                  height: targetRect.height + 6,
                  boxShadow: '0 0 0 3px white, 0 0 20px rgba(255,255,255,0.4)',
                }}
              />
            </>
          )}

          {renderTooltip()}
        </>
      )}
    </div>
  )
}
