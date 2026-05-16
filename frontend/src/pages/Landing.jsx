/**
 * Landing.jsx — Pixel-faithful port of the Figma design (1920×1080 canvas).
 * All positions expressed as vw/vh so the layout scales proportionally.
 * Font: Tusker Grotesk 5800 Super (loaded via Fontshare in index.html)
 * Characters: /Group 160.png (lecturer, orange card) · /Group 159.png (student, purple card)
 */

import { Link } from 'react-router-dom'

/* ─── scale helpers (design canvas = 1920 × 1080) ───────────── */
const vw = (px) => `${(px / 1920) * 100}vw`
const vh = (px) => `${(px / 1080) * 100}vh`

/* Tusker Grotesk 5800 Super */
const TG = {
  fontFamily: '"Tusker Grotesk", sans-serif',
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

      {/* ══════════════════════════════════════════════════
          LOGO  —  "M. LecturaMind"  top-left
          M. in dark #202125 · LecturaMind in blue #2e54fe
      ══════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(39),
          display: 'flex',
          alignItems: 'baseline',
          gap: vw(4),
          lineHeight: 1,
        }}
      >
        {/* "M." — dark */}
        <span
          style={{
            ...TG,
            fontSize: vw(30.74),
            color: '#202125',
            letterSpacing: '-0.01em',
          }}
        >
          M.
        </span>
        {/* "LecturaMind" — blue */}
        <span
          style={{
            ...TG,
            fontSize: vw(30.74),
            color: '#2e54fe',
            letterSpacing: '-0.01em',
          }}
        >
          LecturaMind
        </span>
      </div>

      {/* ══════════════════════════════════════════════════
          NAV  —  Login · Register  top-right
      ══════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          left: vw(1673.63),
          top: vh(48.25),
          display: 'flex',
          alignItems: 'center',
          gap: vw(10),
        }}
      >
        <Link
          to="/login"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(21),
            fontWeight: 400,
            color: '#000000',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.6'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          Login
        </Link>

        {/* separator dot — Tusker Grotesk */}
        <span
          style={{
            ...TG,
            fontSize: vw(23),
            color: '#202125',
            lineHeight: 1,
          }}
        >
          .
        </span>

        <Link
          to="/register"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(21),
            fontWeight: 400,
            color: '#000000',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.6'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          Register
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════
          ORANGE CARD  —  top, left 1005px
          Border-radius: TL/TR/BL = 27.954px · BR = 246.5px
      ══════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          left: vw(1005),
          top: vh(112),
          width: vw(536),
          height: vh(509),
          backgroundColor: '#ffa000',
          borderRadius: `${vw(27.954)} ${vw(27.954)} ${vw(246.5)} ${vw(27.954)}`,
          overflow: 'hidden',
        }}
      >
        <img
          src="/Group 160.png"
          alt="Lecturer"
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '105%',
            height: '105%',
            objectFit: 'contain',
            objectPosition: 'bottom center',
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════
          PURPLE CARD  —  bottom, left 1319px
          Border-radius: TL = 239.512px · TR/BR/BL = 27.161px
      ══════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          left: vw(1319),
          top: vh(522),
          width: vw(521),
          height: vh(505),
          backgroundColor: '#dd7dff',
          borderRadius: `${vw(239.512)} ${vw(27.161)} ${vw(27.161)} ${vw(27.161)}`,
          overflow: 'hidden',
        }}
      >
        <img
          src="/Group 159.png"
          alt="Student"
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '105%',
            height: '105%',
            objectFit: 'contain',
            objectPosition: 'bottom center',
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════
          HEADLINE  —  "Powering Smarter Universities"
          left 80px · top 305.63px · 164.556px · #2e54fe
      ══════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(305.63),
          width: vw(1240),
        }}
      >
        <p
          style={{
            ...TG,
            fontSize: vw(164.556),
            color: '#2e54fe',
            lineHeight: 0.849,
            margin: 0,
            padding: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {'Powering Smarter\nUniversities'}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════
          SUBTITLE  —  small body text  left 80px top 939px
      ══════════════════════════════════════════════════ */}
      <p
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(939),
          width: vw(591.848),
          fontFamily: 'Inter, sans-serif',
          fontSize: vw(21.522),
          fontWeight: 400,
          color: '#202125',
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        An AI-powered platform designed to support lecturers, engage students, and modernize higher education.
      </p>

      {/* ══════════════════════════════════════════════════
          CTA — "Get Started"  left 740px · blue pill
      ══════════════════════════════════════════════════ */}
      <Link
        to="/register"
        style={{
          position: 'absolute',
          left: vw(740),
          top: vh(936.16),
          width: vw(340),
          height: vh(60.673),
          backgroundColor: '#2e54fe',
          borderRadius: vw(32.697),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
        onMouseOut={e => e.currentTarget.style.opacity = '1'}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(23.343),
            fontWeight: 700,
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          Get Started
        </span>
      </Link>

      {/* ══════════════════════════════════════════════════
          CTA — "Login"  left 1092px · gray pill
      ══════════════════════════════════════════════════ */}
      <Link
        to="/login"
        style={{
          position: 'absolute',
          left: vw(1092),
          top: vh(935.81),
          width: vw(174),
          height: vh(61.683),
          backgroundColor: '#ededed',
          borderRadius: vw(33.319),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseOver={e => e.currentTarget.style.opacity = '0.75'}
        onMouseOut={e => e.currentTarget.style.opacity = '1'}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(23.787),
            fontWeight: 700,
            color: '#000000',
            whiteSpace: 'nowrap',
          }}
        >
          Login
        </span>
      </Link>

    </div>
  )
}
