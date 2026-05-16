/**
 * Landing.jsx — Pixel-faithful port of Figma node 2300:93 (1920×1080 canvas).
 *
 * FONT  : Tusker Grotesk 5800 Super — loaded via Fontshare @import in index.css
 *         CSS usage: fontFamily "'Tusker Grotesk', sans-serif", fontWeight 800
 *
 * IMAGES: Group 160.png → orange-card area (lecturer)
 *         Group 159.png → purple-card area (student)
 *         Both PNGs are placed DIRECTLY as <img> — NO coloured card divs.
 *         The PNG files already carry their own backgrounds & rounded corners.
 *
 * SCALE : All positions from the 1920×1080 Figma canvas.
 *         vw(n)  = n / 1920 × 100vw
 *         vh(n)  = n / 1080 × 100vh
 */

import { Link } from 'react-router-dom'

const vw = (n) => `${(n / 1920) * 100}vw`
const vh = (n) => `${(n / 1080) * 100}vh`

/* Tusker Grotesk 5800 Super shorthand */
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

      {/* ────────────────────────────────────────────────────
          LOGO  "M. LecturaMind"
          Figma: left 80px, top 39px, 30.74px
          "M." → #202125   "LecturaMind" → #2e54fe
      ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(39),
          display: 'flex',
          alignItems: 'baseline',
          gap: vw(3),
          lineHeight: 1,
        }}
      >
        <span style={{ ...TG800, fontSize: vw(30.74), color: '#202125' }}>M.</span>
        <span style={{ ...TG800, fontSize: vw(30.74), color: '#2e54fe' }}>LecturaMind</span>
      </div>

      {/* ────────────────────────────────────────────────────
          NAV  Login · Register
          Figma: "Login" left 1673.63px top 48.25px
                 "."    left 1740.38px  (Tusker Grotesk separator)
                 "Register" left 1760.63px top 48.25px
      ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: vw(1673.63),
          top: vh(48.25),
          display: 'flex',
          alignItems: 'center',
          gap: vw(8),
          whiteSpace: 'nowrap',
        }}
      >
        <Link
          to="/login"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(21),
            fontWeight: 400,
            color: '#000',
            textDecoration: 'none',
          }}
        >
          Login
        </Link>

        {/* separator rendered in Tusker Grotesk like the Figma design */}
        <span style={{ ...TG800, fontSize: vw(23), color: '#202125', lineHeight: 1 }}>.</span>

        <Link
          to="/register"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(21),
            fontWeight: 400,
            color: '#000',
            textDecoration: 'none',
          }}
        >
          Register
        </Link>
      </div>

      {/* ────────────────────────────────────────────────────
          GROUP 160.png — Lecturer (orange card area)
          Figma card: left 1005px, top 112px, 536 × 509px
          The PNG already contains the background & rounded corners.
      ──────────────────────────────────────────────────── */}
      <img
        src="/Group 160.png"
        alt="Lecturer"
        style={{
          position: 'absolute',
          left: vw(1005),
          top: vh(112),
          width: vw(536),
          height: vh(509),
          objectFit: 'cover',
          display: 'block',
        }}
      />

      {/* ────────────────────────────────────────────────────
          GROUP 159.png — Student (purple card area)
          Figma card: left 1319px, top 522px, 521 × 505px
          The PNG already contains the background & rounded corners.
      ──────────────────────────────────────────────────── */}
      <img
        src="/Group 159.png"
        alt="Student"
        style={{
          position: 'absolute',
          left: vw(1319),
          top: vh(522),
          width: vw(521),
          height: vh(505),
          objectFit: 'cover',
          display: 'block',
        }}
      />

      {/* ────────────────────────────────────────────────────
          HEADLINE  "Powering Smarter Universities"
          Figma: left 80px, top 305.63px, 164.556px, #2e54fe
                 line-height 84.9%   width 1240px
      ──────────────────────────────────────────────────── */}
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
            ...TG800,
            fontSize: vw(164.556),
            color: '#2e54fe',
            lineHeight: 0.849,
            margin: 0,
            padding: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {'Powering Smarter \nUniversities'}
        </p>
      </div>

      {/* ────────────────────────────────────────────────────
          SUBTITLE
          Figma: left 80px, top 939px, width 591.848px, 21.522px
      ──────────────────────────────────────────────────── */}
      <p
        style={{
          position: 'absolute',
          left: vw(80),
          top: vh(939),
          width: vw(591.848),
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          fontSize: vw(21.522),
          fontWeight: 400,
          color: '#202125',
          lineHeight: 1.45,
        }}
      >
        An AI-powered platform designed to support lecturers, engage students,
        and modernize higher education.
      </p>

      {/* ────────────────────────────────────────────────────
          "Get Started" CTA — blue pill
          Figma: left 740px, top 936.16px, 340 × 60.673px
                 bg #2e54fe  radius 32.697px
      ──────────────────────────────────────────────────── */}
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
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(23.343),
            fontWeight: 700,
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          Get Started
        </span>
      </Link>

      {/* ────────────────────────────────────────────────────
          "Login" CTA — grey pill
          Figma: left 1092px, top 935.81px, 174 × 61.683px
                 bg #ededed  radius 33.319px
      ──────────────────────────────────────────────────── */}
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
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: vw(23.787),
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
