/**
 * Landing.jsx — Figma node 2300:93 (1920×1080 canvas).
 * Font : Tusker Grotesk 5800 Super via @font-face in index.html
 * Images: Group 160.png (lecturer), Group 159.png (student) — raw PNGs,
 *         no card containers. Natural aspect-ratio preserved.
 */

import { Link } from 'react-router-dom'

const vw = (n) => `${(n / 1920) * 100}vw`
const vh = (n) => `${(n / 1080) * 100}vh`

const TG800 = {
  fontFamily: "'Tusker Grotesk', sans-serif",
  fontWeight: 800,
  fontStyle: 'normal',
}

export default function Landing() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
      }}
    >

      {/* ── LOGO  "M. LecturaMind" ───────────────────────────────
          Reduced from Figma 30.74px → 20px equivalent at 1920px
          so it reads small and clean at actual viewport sizes.
      ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(44),
          display: 'flex',
          alignItems: 'baseline',
          gap: vw(3),
          lineHeight: 1,
        }}
      >
        <span style={{ ...TG800, fontSize: vw(20), color: '#202125' }}>M.</span>
        <span style={{ ...TG800, fontSize: vw(20), color: '#2e54fe' }}>LecturaMind</span>
      </div>

      {/* ── NAV  Login · Register ────────────────────────────────
          Reduced from 21px → 15px to match the smaller logo size.
      ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          right: vw(80),           /* anchor to right edge so it never overflows */
          top: vh(44),
          display: 'flex',
          alignItems: 'center',
          gap: vw(10),
          whiteSpace: 'nowrap',
        }}
      >
        <Link
          to="/login"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(15),
            fontWeight: 500,
            color: '#000',
            textDecoration: 'none',
          }}
        >
          Login
        </Link>

        {/* bullet separator — Tusker Grotesk dot */}
        <span style={{ ...TG800, fontSize: vw(16), color: '#202125', lineHeight: 1 }}>.</span>

        <Link
          to="/register"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(15),
            fontWeight: 500,
            color: '#000',
            textDecoration: 'none',
          }}
        >
          Register
        </Link>
      </div>

      {/* ── GROUP 160.png — Lecturer (orange card) ───────────────
          Positioned at Figma card coords. height:'auto' lets the
          PNG render at its own aspect-ratio so the built-in
          rounded corners and shape are never cropped.
      ──────────────────────────────────────────────────────────── */}
      <img
        src="/Group%20160.png"
        alt="Lecturer"
        style={{
          position: 'absolute',
          left: vw(1005),
          top: vh(80),
          width: vw(530),
          height: 'auto',         /* natural shape — no cropping */
          display: 'block',
        }}
      />

      {/* ── GROUP 159.png — Student (purple card) ────────────────
          Same approach — height auto, only width constrained.
      ──────────────────────────────────────────────────────────── */}
      <img
        src="/Group%20159.png"
        alt="Student"
        style={{
          position: 'absolute',
          left: vw(1310),
          top: vh(460),
          width: vw(530),
          height: 'auto',         /* natural shape — no cropping */
          display: 'block',
        }}
      />

      {/* ── HEADLINE ─────────────────────────────────────────────
          Moved lower (vh 430) so it sits close to the subtitle.
          lineHeight raised from 0.849 → 1.08 for clear line gaps.
      ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(310),
          width: vw(900),
        }}
      >
        <p
          style={{
            ...TG800,
            fontSize: vw(164.556),
            color: '#2e54fe',
            lineHeight: 1.08,       /* spaced out as requested */
            margin: 0,
            padding: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {'Powering\nSmarter\nUniversities'}
        </p>
      </div>

      {/* ── SUBTITLE ─────────────────────────────────────────────
          Kept at Figma bottom position vh(939).
      ──────────────────────────────────────────────────────────── */}
      <p
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(939),
          width: vw(500),
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          fontSize: vw(18),
          fontWeight: 400,
          color: '#202125',
          lineHeight: 1.5,
        }}
      >
        An AI-powered platform designed to support lecturers, engage
        students, and modernize higher education.
      </p>

      {/* ── "Get Started" — blue pill ────────────────────────────
          Figma: left 740px, top 936.16px, 340×61px, #2e54fe
      ──────────────────────────────────────────────────────────── */}
      <Link
        to="/register"
        style={{
          position: 'absolute',
          left: vw(620),
          top: vh(936),
          width: vw(300),
          height: vh(60),
          backgroundColor: '#2e54fe',
          borderRadius: vw(33),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(19),
            fontWeight: 700,
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          Get Started
        </span>
      </Link>

      {/* ── "Login" — grey pill ──────────────────────────────────
          Figma: left 1092px, top 935.81px, 174×62px, #ededed
      ──────────────────────────────────────────────────────────── */}
      <Link
        to="/login"
        style={{
          position: 'absolute',
          left: vw(935),
          top: vh(936),
          width: vw(155),
          height: vh(60),
          backgroundColor: '#ededed',
          borderRadius: vw(33),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(19),
            fontWeight: 700,
            color: '#000',
            whiteSpace: 'nowrap',
          }}
        >
          Login
        </span>
      </Link>

    </div>
  )
}
