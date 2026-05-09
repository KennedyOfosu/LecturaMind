/**
 * QuizCard.jsx — Single quiz question with four clickable options.
 */

export function QuizCard({ question, questionIndex, total, selectedAnswer, onSelect }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-gray-400 mb-1">Question {questionIndex + 1} of {total}</p>
        <p className="text-lg font-semibold text-navy leading-relaxed">{question.question}</p>
      </div>

      <div className="grid gap-3">
        {question.options.map((option, i) => {
          const isSelected = selectedAnswer === option
          return (
            <button
              key={i}
              onClick={() => onSelect(option)}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
                isSelected
                  ? 'border-teal bg-teal/10 text-teal-dark'
                  : 'border-gray-200 hover:border-navy/40 hover:bg-gray-50'
              }`}
            >
              <span className="font-semibold mr-3 text-gray-400">
                {String.fromCharCode(65 + i)}.
              </span>
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
