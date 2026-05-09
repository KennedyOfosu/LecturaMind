/**
 * TypingIndicator.jsx — Animated three-dot "AI is thinking" indicator.
 */

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="bg-teal/10 border border-teal/20 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-teal rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
