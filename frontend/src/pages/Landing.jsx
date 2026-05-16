/**
 * Landing.jsx — Hero section replicating the Figma design.
 * Font: Tusker Grotesk (loaded via Fontshare in index.html)
 * Characters: /Group 160.png (lecturer, orange card) and /Group 159.png (student, purple card)
 */

import { Link } from 'react-router-dom'

/* ── Tusker Grotesk utility style ─────────────────────────────── */
const tusker = { fontFamily: '"Tusker Grotesk", sans-serif' }

export default function Landing() {
  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col select-none"
      style={{ backgroundColor: '#EFEFEF' }}
    >

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-10 pt-8 shrink-0 relative z-20">

        {/* Brand: M. LecturaMind in Tusker Grotesk */}
        <div className="flex items-center gap-0.5" style={tusker}>
          <span
            className="text-gray-900 leading-none"
            style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em' }}
          >
            M.
          </span>
          <span
            className="text-gray-900 leading-none ml-1.5"
            style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            LecturaMind
          </span>
        </div>

        {/* Login • Register */}
        <div className="flex items-center gap-3 text-sm font-medium text-gray-800">
          <Link to="/login" className="hover:text-gray-500 transition-colors">Login</Link>
          <span className="text-gray-400 text-xs">■</span>
          <Link to="/register" className="hover:text-gray-500 transition-colors">Register</Link>
        </div>
      </div>

      {/* ── Main hero body ───────────────────────────────────────── */}
      <div className="flex-1 flex items-stretch overflow-hidden relative">

        {/* ── Left: headline + subtitle + CTAs ── */}
        <div className="flex flex-col justify-end pb-16 pl-10 pr-6 z-10 relative"
             style={{ width: '55%' }}>

          {/* Giant headline */}
          <h1
            className="leading-none text-left mb-6"
            style={{
              ...tusker,
              fontWeight: 900,
              color: '#3250FF',
              fontSize: 'clamp(4.5rem, 10.5vw, 9.5rem)',
              letterSpacing: '-0.02em',
              lineHeight: 0.9,
            }}
          >
            Powering<br />
            Smarter<br />
            Universities
          </h1>

          {/* Subtitle + buttons row */}
          <div className="flex items-end gap-10 flex-wrap">
            {/* Subtitle */}
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              An AI-powered platform designed to support lecturers,<br />
              engage students, and modernize higher education.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/register"
                className="px-8 py-3.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#3250FF' }}
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="px-7 py-3.5 rounded-full text-sm font-semibold text-gray-800 bg-white border border-gray-200 transition-all hover:border-gray-400"
              >
                Login
              </Link>
            </div>
          </div>
        </div>

        {/* ── Right: two overlapping image cards ── */}
        <div className="flex-1 relative overflow-visible" style={{ width: '45%' }}>

          {/* Top card — Orange — Lecturer with tablet (Group 160.png) */}
          <div
            className="absolute overflow-hidden"
            style={{
              top: '4%',
              left: '8%',
              width: '62%',
              aspectRatio: '1 / 1.1',
              backgroundColor: '#FF9A00',
              borderRadius: '24px',
              /* subtle circular highlight matching Figma */
              background: 'radial-gradient(ellipse 90% 80% at 55% 30%, #FFB800 0%, #FF9500 55%, #FF8A00 100%)',
            }}
          >
            <img
              src="/Group 160.png"
              alt="Lecturer"
              className="w-full h-full object-contain object-bottom"
              style={{ transform: 'scale(1.05)', transformOrigin: 'bottom center' }}
            />
          </div>

          {/* Bottom card — Purple — Student with laptop (Group 159.png) */}
          <div
            className="absolute overflow-hidden"
            style={{
              top: '48%',
              left: '32%',
              right: '-8%',          /* intentionally bleeds off the right edge */
              aspectRatio: '1 / 0.9',
              borderRadius: '24px',
              background: 'radial-gradient(ellipse 80% 75% at 35% 30%, #E580FF 0%, #CC55EE 50%, #BB44DC 100%)',
            }}
          >
            <img
              src="/Group 159.png"
              alt="Student"
              className="w-full h-full object-contain object-bottom"
              style={{ transform: 'scale(1.05)', transformOrigin: 'bottom center' }}
            />
          </div>

        </div>
      </div>
    </div>
  )
}
