/**
 * QuizGenerator.jsx — UI panel for triggering AI quiz generation.
 */

import { useState } from 'react'
import { Button } from '../ui/Button'

export function QuizGenerator({ onGenerate, loading }) {
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState('medium')

  const handleSubmit = (e) => {
    e.preventDefault()
    onGenerate({ num_questions: numQuestions, difficulty })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

      <Button type="submit" variant="teal" loading={loading} className="w-full">
        {loading ? 'Generating…' : 'Generate Quiz with AI'}
      </Button>
    </form>
  )
}
