/**
 * LiveQuestionFeed.jsx — Scrolling feed of live Q&A questions.
 */

import { timeAgo } from '../../utils/formatDate'
import { Button } from '../ui/Button'

export function LiveQuestionFeed({ questions = [], onAnswer, isLecturer = false }) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-3xl mb-2">❓</div>
        <p className="text-sm">No questions yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q) => (
        <div
          key={q.id}
          className={`rounded-xl border p-4 ${q.answered ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-navy">{q.student_name || 'Student'}</span>
                <span className="text-xs text-gray-400">{timeAgo(q.asked_at)}</span>
              </div>
              <p className="text-sm text-gray-800">{q.question}</p>

              {q.answered && q.answer && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">✓ Lecturer's Answer</p>
                  <p className="text-sm text-emerald-800">{q.answer}</p>
                </div>
              )}
            </div>

            {isLecturer && !q.answered && onAnswer && (
              <Button size="sm" variant="teal" onClick={() => onAnswer(q)}>
                Answer
              </Button>
            )}
            {q.answered && (
              <span className="text-emerald-500 text-lg">✓</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
