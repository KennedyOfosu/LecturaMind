/**
 * Landing.jsx — Single hero section inspired by the IOH reference design.
 * Full-screen dark background, no menu bar, Login + Register top-right,
 * headline bottom-left, stats panel right, CTA bottom-right.
 */

import { Link } from 'react-router-dom'

const STATS = [
  { label: 'Course Materials',  value: '180' },
  { label: 'Active Students',   value: '342' },
  { label: 'AI Responses',      value: '8,500' },
]

export default function Landing() {
  return (
    <div
      className="relative h-screen w-full overflow-hidden flex flex-col"
      style={{
        /* dark academic background — deep blue-black gradient with subtle warm layer */
        background: 'linear-gradient(135deg, #080d18 0%, #0d1525 40%, #111d2e 70%, #0a1020 100%)',
      }}
    >
      {/* ── Decorative grain / texture overlay ──────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 65% 40%, rgba(255,255,255,0.035) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 20% 70%, rgba(255,255,255,0.02) 0%, transparent 60%)
          `,
        }}
      />

      {/* ── Subtle grid lines (mimics the IOH divider aesthetic) ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* ── Top bar: only Login + Register ──────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-8">
        {/* Brand mark (no menu) */}
        <div className="flex items-center gap-2.5">
          <svg width="24" height="20" viewBox="0 0 40 32" fill="none">
            <path d="M2 30L20 4L38 30" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 30L20 14L30 30" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white font-semibold tracking-tight text-base">LecturaMind</span>
        </div>

        {/* Buttons — dark pill style matching the IOH screenshot */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span>Student Register</span>
            {/* diagonal arrow icon matching IOH */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M7 17L17 7M17 7H7M17 7v10"/>
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Main hero body ───────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-end pb-16 px-10">
        <div className="w-full flex items-end justify-between gap-12">

          {/* Left: headline + subtitle */}
          <div className="max-w-xl">
            <h1
              className="text-white font-bold leading-none mb-5"
              style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.2rem)', letterSpacing: '-0.02em' }}
            >
              The AI-powered<br />
              teaching assistant<br />
              for higher education
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-md">
              Upload your course materials, and let LecturaMind answer
              every student question — instantly, accurately, and 24/7.
            </p>
          </div>

          {/* Right: stats panel + CTA */}
          <div className="shrink-0 flex flex-col items-end gap-6" style={{ minWidth: 260 }}>

            {/* Stats — horizontal dividers, IOH style */}
            <div className="w-full">
              {STATS.map(({ label, value }, i) => (
                <div key={label}>
                  {/* top divider line */}
                  <div className="w-full h-px bg-white/20 mb-4" />
                  <div className="flex items-end justify-between mb-4">
                    <span className="text-white/55 text-sm font-light tracking-wide">{label}</span>
                    {/* ellipsis dots matching IOH */}
                    <span className="text-white/30 text-xs tracking-widest">···</span>
                  </div>
                  <p
                    className="text-white font-light mb-3"
                    style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', letterSpacing: '-0.02em' }}
                  >
                    {value}
                  </p>
                </div>
              ))}
              {/* final bottom divider */}
              <div className="w-full h-px bg-white/20" />
            </div>

            {/* CTA button — bottom right */}
            <Link
              to="/register"
              className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:bg-white/15"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.16)',
                backdropFilter: 'blur(8px)',
              }}
            >
              Get Started
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>

        </div>
      </div>

      {/* ── Bottom footer line ────────────────────────────────────── */}
      <div className="relative z-10 px-10 pb-6 flex items-center justify-between">
        <p className="text-white/25 text-xs">
          © 2026 Kennedy Ofosu · SIIMT University College, Accra, Ghana
        </p>
        <Link
          to="/login"
          className="text-white/40 text-xs hover:text-white/70 transition-colors"
        >
          Lecturer Login →
        </Link>
      </div>
    </div>
  )
}
