/**
 * QuizGenerator.jsx — UI panel for triggering AI quiz generation.
 *
 * Two assessment modes:
 *   - Hot Test:     questions scoped to ONE selected lecture material (slide),
 *                   for assessing students right after that day's lecture.
 *   - General Quiz: questions drawn from ALL course materials, for an
 *                   end-of-period assessment across the whole scope.
 */

import { useState } from 'react'
import { Button } from '../ui/Button'

const TYPES = [
  {
    key: 'hot',
    label: 'Hot Test',
    desc: 'Assess one lecture / slide',
  },
  {
    key: 'general',
    label: 'General Quiz',
    desc: 'Whole course scope',
  },
]

export function QuizGenerator({ onGenerate, loading, materials = [] }) {
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty]     = useState('medium')
  const [quizType, setQuizType]         = useState('general')
  const [materialId, setMaterialId]     = useState(materials[0]?.id || '')
  const [timerMinutes, setTimerMinutes] = useState(30)

  const selectType = (key) => {
    setQuizType(key)
    if (key === 'hot' && !materialId && materials[0]) {
      setMaterialId(materials[0].id)
    }
  }

  const hotNeedsMaterial = quizType === 'hot' && !materialId

  const handleSubmit = (e) => {
    e.preventDefault()
    if (hotNeedsMaterial) return
    onGenerate({
      num_questions: numQuestions,
      difficulty,
      quiz_type:     quizType,
      material_id:   quizType === 'hot' ? materialId : null,
      timer_minutes: timerMinutes,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Assessment type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Type</label>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectType(t.key)}
              className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border-2 text-left transition-colors ${
                quizType === t.key
                  ? 'border-teal bg-teal/10'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`text-sm font-semibold ${quizType === t.key ? 'text-teal-dark' : 'text-gray-700'}`}>
                {t.label}
              </span>
              <span className="text-[11px] text-gray-400 leading-tight">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Slide picker — only for hot tests */}
      {quizType === 'hot' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Which lecture material?
          </label>
          {materials.length === 0 ? (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No materials uploaded yet. Upload a slide/document for this course first.
            </p>
          ) : (
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-white"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.file_name}</option>
              ))}
            </select>
          )}
          <p className="text-[11px] text-gray-400 mt-1.5">
            The AI will only ask questions from this material — nothing students haven't been taught yet.
          </p>
        </div>
      )}

      {/* Number of questions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Questions: <span className="text-teal font-bold">{numQuestions}</span>
        </label>
        <input
          type="range"
          min="5"
          max="20"
          value={numQuestions}
          onChange={(e) => setNumQuestions(Number(e.target.value))}
          className="w-full accent-teal"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>5</span><span>20</span>
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
        <div className="flex gap-2">
          {['easy', 'medium', 'hard'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border-2 transition-colors ${
                difficulty === d
                  ? 'border-teal bg-teal/10 text-teal-dark'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Timer */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Limit: <span className="text-teal font-bold">{timerMinutes} minutes</span>
        </label>
        <input
          type="range"
          min="5"
          max="120"
          step="5"
          value={timerMinutes}
          onChange={(e) => setTimerMinutes(Number(e.target.value))}
          className="w-full accent-teal"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>5 min</span><span>120 min</span>
        </div>
      </div>

      <Button type="submit" variant="teal" loading={loading} disabled={hotNeedsMaterial} className="w-full">
        {loading
          ? 'Generating…'
          : quizType === 'hot' ? 'Generate Hot Test with AI' : 'Generate General Quiz with AI'}
      </Button>
    </form>
  )
}
