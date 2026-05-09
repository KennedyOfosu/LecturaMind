/**
 * QuizResults.jsx — Score display with per-question breakdown and explanations.
 */

import { Button } from '../ui/Button'

export function QuizResults({ score, total, questions, userAnswers, onRetry }) {
  const percentage = Math.round((score / total) * 100)
  const passed = percentage >= 50

  return (
    <div className="flex flex-col gap-8">
      {/* Score card */}
      <div className={`rounded-2xl p-8 text-center text-white ${passed ? 'bg-emerald-500' : 'bg-red-400'}`}>
        <div className="text-6xl font-bold mb-2">{percentage}%</div>
        <div className="text-xl font-semibold mb-1">{passed ? '🎉 Well done!' : '📚 Keep studying!'}</div>
        <div className="text-sm opacity-90">{score} out of {total} correct</div>
      </div>

      {/* Answer review */}
      <div className="flex flex-col gap-4">
        <h3 className="font-semibold text-navy text-lg">Answer Review</h3>
        {questions.map((q, i) => {
          const userAnswer = userAnswers[String(i)]
          const correct = userAnswer === q.correct_answer
          return (
            <div key={i} className={`rounded-xl border-2 p-5 ${correct ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <p className="font-medium text-gray-800 mb-3">{i + 1}. {q.question}</p>
              <div className="flex flex-col gap-1 text-sm mb-3">
                {q.options.map((opt, j) => (
                  <div key={j} className={`px-3 py-1.5 rounded-lg ${
                    opt === q.correct_answer
                      ? 'bg-emerald-100 text-emerald-800 font-medium'
                      : opt === userAnswer && !correct
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600'
                  }`}>
                    {String.fromCharCode(65 + j)}. {opt}
                    {opt === q.correct_answer && ' ✓'}
                    {opt === userAnswer && !correct && ' ✕'}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="text-xs text-gray-600 bg-white rounded-lg p-3 border border-gray-100">
                  💡 {q.explanation}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {onRetry && (
        <Button variant="teal" onClick={onRetry} className="self-start">
          Try Again
        </Button>
      )}
    </div>
  )
}
