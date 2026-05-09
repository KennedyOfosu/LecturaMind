/**
 * ChatLogs.jsx — View and flag AI chat logs per course.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { chatService } from '../../services/chatService'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { formatDateTime } from '../../utils/formatDate'

export default function ChatLogs() {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [flagging, setFlagging] = useState(null)

  useEffect(() => {
    courseService.getMyCourses().then((res) => {
      setCourses(res.data)
      if (res.data.length) setSelectedCourse(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedCourse) return
    setLoading(true)
    chatService.getLogs(selectedCourse)
      .then((res) => setLogs(res.data))
      .finally(() => setLoading(false))
  }, [selectedCourse])

  const handleFlag = async (messageId) => {
    setFlagging(messageId)
    try {
      const res = await chatService.flagMessage(messageId)
      setLogs((prev) => prev.map((l) => l.id === messageId ? { ...l, flagged: res.data.flagged } : l))
      toast.success(res.data.flagged ? 'Message flagged' : 'Flag removed')
    } catch {
      toast.error('Failed to update flag')
    } finally {
      setFlagging(null)
    }
  }

  const displayed = filter === 'flagged' ? logs.filter((l) => l.flagged) : logs

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Chat Logs</h1>
        <p className="text-gray-500 text-sm mt-1">Review all student AI queries per course</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.course_name}</option>
          ))}
        </select>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {['all', 'flagged'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 capitalize transition-colors ${filter === f ? 'bg-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {f === 'all' ? 'All Messages' : '🚩 Flagged Only'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !displayed.length ? (
        <EmptyState icon="💬" title={filter === 'flagged' ? 'No flagged messages' : 'No messages yet'} description="Chat logs will appear here as students use the AI chatbot" />
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((log) => (
            <Card key={log.id} className={log.flagged ? 'border-amber-300 bg-amber-50' : ''}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-full bg-navy/10 text-navy flex items-center justify-center text-xs font-bold">
                      {log.profiles?.full_name?.[0] || '?'}
                    </div>
                    <span className="text-sm font-semibold text-navy">{log.profiles?.full_name || 'Student'}</span>
                    {log.flagged && <Badge variant="warning">Flagged</Badge>}
                    <span className="text-xs text-gray-400 ml-auto">{formatDateTime(log.timestamp)}</span>
                  </div>

                  <div className="bg-navy/5 rounded-lg p-3 mb-2">
                    <p className="text-xs text-gray-400 mb-1">Student asked:</p>
                    <p className="text-sm text-gray-800">{log.query}</p>
                  </div>
                  <div className="bg-teal/5 border border-teal/20 rounded-lg p-3">
                    <p className="text-xs text-teal mb-1">AI responded:</p>
                    <p className="text-sm text-gray-700">{log.response}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={log.flagged ? 'warning' : 'ghost'}
                  onClick={() => handleFlag(log.id)}
                  disabled={flagging === log.id}
                  className="shrink-0"
                >
                  {flagging === log.id ? '…' : log.flagged ? '🚩 Unflag' : '🚩 Flag'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
