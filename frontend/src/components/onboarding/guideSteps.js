const studentSteps = [
  {
    id: 'welcome',
    title: 'Welcome to LecturaMind!',
    description:
      'Your AI-powered teaching assistant. This quick tour will guide you through the student dashboard so you know exactly where everything is.',
    icon: '🎓',
    centered: true,
  },
  {
    id: 'home',
    title: 'Home (Dashboard)',
    description:
      'Your dashboard is your command centre. View your enrolled courses, recent activity, announcements, and quick stats — all in one place.',
    icon: '🏠',
    targetSelector: '[data-tour="student-home"]',
    tooltipPosition: 'right',
  },
  {
    id: 'profile',
    title: 'My Profile',
    description:
      'Manage your personal and academic information here. Update your name, phone, programme, level, and profile picture.',
    icon: '👤',
    targetSelector: '[data-tour="student-profile"]',
    tooltipPosition: 'right',
  },
  {
    id: 'courses',
    title: 'Courses',
    description:
      'Your enrolled courses are listed here. Click a course to view materials, join AI chatbot sessions, take quizzes, and more.',
    icon: '📚',
    targetSelector: '[data-tour="student-courses"]',
    tooltipPosition: 'right',
  },
  {
    id: 'completion',
    title: "You're All Set!",
    description:
      'You now know the essentials. Explore the platform at your own pace — the AI assistant is here to help whenever you need it.',
    icon: '🚀',
    centered: true,
    isLast: true,
  },
]

const lecturerSteps = [
  {
    id: 'welcome',
    title: 'Welcome to LecturaMind!',
    description:
      'Your AI-powered teaching assistant. This quick tour will guide you through the lecturer dashboard so you can start managing your courses right away.',
    icon: '🎓',
    centered: true,
  },
  {
    id: 'home',
    title: 'Home (Dashboard)',
    description:
      'Your dashboard gives you an overview of your courses, recent queries, active quizzes, and flagged conversations — everything at a glance.',
    icon: '🏠',
    targetSelector: '[data-tour="lecturer-home"]',
    tooltipPosition: 'right',
  },
  {
    id: 'profile',
    title: 'My Profile',
    description:
      'Update your personal details, department, bio, and profile picture. You can also manage your teaching assignments here.',
    icon: '👤',
    targetSelector: '[data-tour="lecturer-profile"]',
    tooltipPosition: 'right',
  },
  {
    id: 'courses',
    title: 'Courses',
    description:
      'Create and manage your courses here. Enrol students, set course codes, and organise your teaching schedule.',
    icon: '📚',
    targetSelector: '[data-tour="lecturer-courses"]',
    tooltipPosition: 'right',
  },
  {
    id: 'management',
    title: 'Management',
    description:
      'This section contains all your teaching tools. Let us walk through each one — click Next to continue.',
    icon: '⚙️',
    targetSelector: '[data-tour="lecturer-management"]',
    tooltipPosition: 'right',
  },
  {
    id: 'materials',
    title: 'Upload Materials',
    description:
      'Upload PDF or DOCX course materials here. The AI automatically reads and indexes them so students can ask questions about the content.',
    icon: '📄',
    targetSelector: '[data-tour="lecturer-uploadmaterials"]',
    tooltipPosition: 'right',
  },
  {
    id: 'announcements',
    title: 'Announcements',
    description:
      'Post important announcements for your courses. Students will receive them in real time on their dashboard and via toast notifications.',
    icon: '🔔',
    targetSelector: '[data-tour="lecturer-announcements"]',
    tooltipPosition: 'right',
  },
  {
    id: 'quizzes',
    title: 'Generate Quizzes',
    description:
      'Generate AI-powered multiple-choice quizzes from your uploaded course materials. Students can take them live during sessions.',
    icon: '⭐',
    targetSelector: '[data-tour="lecturer-generatequiz"]',
    tooltipPosition: 'right',
  },
  {
    id: 'chatlogs',
    title: 'Chat Logs',
    description:
      'Review and flag AI chatbot conversations between students and the AI. Monitor engagement and identify frequently asked questions.',
    icon: '💬',
    targetSelector: '[data-tour="lecturer-chatlogs"]',
    tooltipPosition: 'right',
  },
  {
    id: 'livemonitor',
    title: 'Live Monitor',
    description:
      'See which students are currently online in your courses in real time. Useful for taking attendance or gauging engagement during live sessions.',
    icon: '👁️',
    targetSelector: '[data-tour="lecturer-livemonitor"]',
    tooltipPosition: 'right',
  },
  {
    id: 'liveqna',
    title: 'Live Q&A',
    description:
      'Run real-time Q&A sessions with your students. Display a session PIN so students can join and ask questions live.',
    icon: '🎙️',
    targetSelector: '[data-tour="lecturer-liveqna"]',
    tooltipPosition: 'right',
  },
  {
    id: 'completion',
    title: "You're All Set!",
    description:
      'You now know every tool at your disposal. Start by creating a course, uploading materials, and inviting your students. The AI assistant is ready when you are.',
    icon: '🚀',
    centered: true,
    isLast: true,
  },
]

export { studentSteps, lecturerSteps }
