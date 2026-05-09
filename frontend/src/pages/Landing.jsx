/**
 * Landing.jsx — Public home page for LecturaMind.
 */

import { Link } from 'react-router-dom'

const features = [
  { icon: '🤖', title: 'AI Chatbot', desc: 'Students get instant, accurate answers powered by course content — available 24/7.' },
  { icon: '👁️', title: 'Live Monitoring', desc: 'Lecturers see who is actively studying in real time across all their courses.' },
  { icon: '📝', title: 'Quiz Generator', desc: 'AI creates tailored quizzes from uploaded materials at any difficulty level.' },
  { icon: '🎙️', title: 'Real-time Q&A', desc: 'Host live Q&A sessions where student questions appear instantly for the lecturer.' },
  { icon: '📄', title: 'Material Management', desc: 'Upload PDF and DOCX notes; the AI extracts and indexes them automatically.' },
  { icon: '📢', title: 'Announcements', desc: 'Post course announcements that students see the moment they log in.' },
]

const steps = [
  { step: '1', title: 'Lecturer Uploads Notes', desc: 'Upload PDF or DOCX course materials — the AI processes and indexes them instantly.' },
  { step: '2', title: 'AI Processes Content', desc: 'The AI reads and understands all uploaded materials, ready to answer any question.' },
  { step: '3', title: 'Students Get Answers', desc: 'Students chat with the AI and receive accurate, context-aware answers immediately.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <nav className="bg-navy text-white px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="LecturaMind" className="h-8 w-8" />
          <span className="font-bold text-lg">LecturaMind</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm font-medium rounded-lg border border-white/30 hover:bg-white/10 transition-colors">
            Login
          </Link>
          <Link to="/register" className="px-4 py-2 text-sm font-medium rounded-lg bg-teal hover:bg-teal-dark transition-colors">
            Register
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-navy text-white pt-24 pb-32 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal/20 text-teal-light rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            🎓 AI-Powered Teaching Assistant
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            The smarter way to<br />
            <span className="text-teal">teach and learn</span>
          </h1>
          <p className="text-xl text-white/70 mb-10 leading-relaxed">
            LecturaMind connects lecturers and students through AI — letting students get instant answers
            from course materials while giving lecturers real-time insight into learning activity.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register" className="px-8 py-3.5 bg-teal hover:bg-teal-dark text-white font-semibold rounded-xl text-lg transition-colors shadow-lg">
              Get Started Free
            </Link>
            <Link to="/login" className="px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-lg transition-colors border border-white/20">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-navy mb-3">Everything you need</h2>
          <p className="text-gray-500 text-lg">Six powerful features built for higher education</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-navy text-lg mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-navy text-white py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">How it works</h2>
            <p className="text-white/60 text-lg">Three simple steps to AI-powered learning</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="h-14 w-14 rounded-full bg-teal flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {step}
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-navy mb-4">Ready to transform your classroom?</h2>
          <p className="text-gray-500 mb-8">Join LecturaMind and bring AI-powered learning to your institution.</p>
          <Link to="/register" className="inline-block px-8 py-3.5 bg-teal hover:bg-teal-dark text-white font-semibold rounded-xl text-lg transition-colors shadow-lg">
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white/60 py-8 px-6 text-center text-sm">
        <p className="font-semibold text-white mb-1">LecturaMind</p>
        <p>Built by Kennedy Ofosu · BSc Information Technology · SIIMT University College, Accra, Ghana · 2026</p>
      </footer>
    </div>
  )
}
