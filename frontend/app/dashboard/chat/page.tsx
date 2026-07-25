'use client'

import { useState, useRef, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { chatQuery, chatStream, formatCurrency, getUploadStatus } from '@/lib/api'
import {
  Send, Bot, User, Sparkles, Code, BarChart2,
  Loader, Brain, TrendingUp, AlertCircle, Database,
  ChevronDown, ChevronUp, Plus, History, Trash2, MessageSquare, Clock
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  data?: any[]
  sql?: string
  confidence?: number
  key_insight?: string
  predictions?: string
  source?: string
  rag_chunks_used?: number
}

interface ChatSession {
  id: string
  title: string
  filename: string
  createdAt: string
  messages: Message[]
}

const SAMPLE_QUESTIONS = [
  "Which category drives the most revenue?",
  "Predict revenue for next quarter based on trends",
  "What are the top 5 performers by revenue?",
  "Show me monthly revenue trends and growth rates",
  "Which factors correlate most with high revenue?",
  "Identify any revenue drops and explain why",
  "Give me a full business performance summary",
  "What marketing insights can you derive from this data?",
]

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  gemini: { label: 'Gemini AI', color: '#4f8ef7' },
  claude: { label: 'Claude AI', color: '#d4a842' },
  openai: { label: 'GPT-4', color: '#10b981' },
  rules: { label: 'Rule Engine', color: '#6b7280' },
  system: { label: 'System Notice', color: '#ef4444' },
}

// ---------------------------------------------------------------------------
// Markdown Formatter Component
// ---------------------------------------------------------------------------
function FormattedMarkdownText({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div style={{ lineHeight: 1.7, fontSize: 14 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} style={{ height: 8 }} />

        // Header 3
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} style={{
              fontSize: 15, fontWeight: 700, color: 'var(--accent-bright)',
              marginTop: 12, marginBottom: 6, fontFamily: 'var(--font-display)'
            }}>
              {renderInlineStyles(trimmed.slice(4))}
            </h4>
          )
        }

        // Header 2 or 1
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          const text = trimmed.replace(/^#+\s*/, '')
          return (
            <h3 key={idx} style={{
              fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
              marginTop: 14, marginBottom: 8, fontFamily: 'var(--font-display)'
            }}>
              {renderInlineStyles(text)}
            </h3>
          )
        }

        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, marginLeft: 6, marginBottom: 4 }}>
              <span style={{ color: 'var(--accent-bright)', fontWeight: 700 }}>•</span>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>
                {renderInlineStyles(trimmed.slice(2))}
              </span>
            </div>
          )
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, marginLeft: 6, marginBottom: 4 }}>
              <span style={{ color: 'var(--accent-bright)', fontWeight: 700, fontSize: 13 }}>{numMatch[1]}.</span>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>
                {renderInlineStyles(numMatch[2])}
              </span>
            </div>
          )
        }

        // Regular paragraph
        return (
          <p key={idx} style={{ marginBottom: 6, color: 'var(--text-primary)' }}>
            {renderInlineStyles(line)}
          </p>
        )
      })}
    </div>
  )
}

function renderInlineStyles(text: string) {
  // Simple regex parser for **bold** and `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--accent-bright)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: 4,
          fontFamily: 'var(--font-mono)', fontSize: 12, color: '#10b981'
        }}>
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [showSQL, setShowSQL] = useState<number | null>(null)
  const [showPredictions, setShowPredictions] = useState<number | null>(null)
  const [dataStatus, setDataStatus] = useState<{
    has_data: boolean; active: boolean; filename: string; rows: number; rag_ready: boolean
  }>({
    has_data: false, active: false, filename: '', rows: 0, rag_ready: false,
  })

  const bottomRef = useRef<HTMLDivElement>(null)

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rr_chat_sessions')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed)
          setCurrentSessionId(parsed[0].id)
          setMessages(parsed[0].messages || [])
          return
        }
      }
    } catch (_) {}
    startNewSession()
  }, [])

  // Save sessions to localStorage when updated
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        localStorage.setItem('rr_chat_sessions', JSON.stringify(sessions))
      } catch (_) {}
    }
  }, [sessions])

  // Auto scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll upload status
  useEffect(() => {
    const check = async () => {
      const status = await getUploadStatus()
      setDataStatus(status)
    }
    check()
    const id = setInterval(check, 8000)
    return () => clearInterval(id)
  }, [])

  const startNewSession = () => {
    const newId = `session_${Date.now()}`
    const welcomeMsg: Message = {
      role: 'assistant',
      content: dataStatus.has_data && dataStatus.active
        ? `Hello! I'm your RevenueRadar Conversational AI analyst. I'm ready to analyze your active dataset (**${dataStatus.filename}** with ${dataStatus.rows.toLocaleString()} records). Ask me about revenue breakdowns, trends, correlations, or future predictions!`
        : "Hello! I'm your RevenueRadar AI analyst. Upload a CSV or XML file on the Dashboard and click **'Start Analysis'** to begin chatting about your data.",
      confidence: 1,
      source: 'gemini',
    }

    const newSession: ChatSession = {
      id: newId,
      title: 'New Analysis Chat',
      filename: dataStatus.filename || 'No File Active',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [welcomeMsg],
    }

    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newId)
    setMessages([welcomeMsg])
  }

  const selectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id)
    setMessages(session.messages)
  }

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const filtered = sessions.filter(s => s.id !== id)
    setSessions(filtered)
    try {
      localStorage.setItem('rr_chat_sessions', JSON.stringify(filtered))
    } catch (_) {}

    if (currentSessionId === id) {
      if (filtered.length > 0) {
        setCurrentSessionId(filtered[0].id)
        setMessages(filtered[0].messages)
      } else {
        startNewSession()
      }
    }
  }

  const updateCurrentSession = (updatedMessages: Message[]) => {
    setMessages(updatedMessages)
    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) {
          const firstUserMsg = updatedMessages.find(m => m.role === 'user')?.content
          const title = firstUserMsg
            ? firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '')
            : s.title
          return {
            ...s,
            title,
            filename: dataStatus.filename || s.filename,
            messages: updatedMessages,
          }
        }
        return s
      })
    )
  }

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: msg }
    const newMessages = [...messages, userMsg]
    updateCurrentSession(newMessages)

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await chatQuery(msg, history)
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.answer,
        data: res.data,
        sql: res.sql,
        confidence: res.confidence,
        key_insight: res.key_insight,
        predictions: res.predictions,
        source: res.source || 'gemini',
        rag_chunks_used: res.rag_chunks_used,
      }
      updateCurrentSession([...newMessages, assistantMsg])
    } catch (err: any) {
      console.error('Chat error:', err)
      const errorMsg: Message = {
        role: 'assistant',
        content: 'Sorry, I could not process that request. Please verify the backend server is running.',
        source: 'system',
      }
      updateCurrentSession([...newMessages, errorMsg])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header title="AI Revenue Assistant" subtitle="Conversational RAG AI — grounded in your uploaded data" />

      {/* Data status bar */}
      {(!dataStatus.has_data || !dataStatus.active) && (
        <div style={{
          padding: '10px 32px',
          background: 'rgba(245,158,11,0.08)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={15} color="#f59e0b" />
          <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
            No active dataset session. Go to Dashboard, select your CSV or XML file, and click &apos;Start Analysis&apos;.
          </span>
        </div>
      )}

      {dataStatus.has_data && dataStatus.active && (
        <div style={{
          padding: '8px 32px',
          background: 'rgba(16,185,129,0.06)',
          borderBottom: '1px solid rgba(16,185,129,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Database size={14} color="#10b981" />
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
            Session Active: <strong>{dataStatus.filename}</strong> · {dataStatus.rows.toLocaleString()} records indexed for RAG · Full multi-turn AI ready
          </span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* LEFT SIDEBAR — CHAT HISTORY SESSIONS */}
        <div style={{
          width: 260, borderRight: '1px solid var(--border)', padding: 16,
          background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column',
        }}>
          {/* New Chat Button */}
          <button
            onClick={startNewSession}
            className="btn-primary"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 13, fontWeight: 700, marginBottom: 20,
            }}
          >
            <Plus size={16} />
            New Chat Session
          </button>

          {/* History Sessions List */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingLeft: 4 }}>
            <History size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              History Sessions ({sessions.length})
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {sessions.map(s => {
              const isSelected = s.id === currentSessionId
              const msgCount = s.messages.filter(m => m.role === 'user').length
              return (
                <div
                  key={s.id}
                  onClick={() => selectSession(s)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 13, fontWeight: isSelected ? 700 : 600,
                      color: isSelected ? 'var(--accent-bright)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170,
                    }}>
                      {s.title}
                    </span>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: 2 }}
                      title="Delete chat session"
                    >
                      <Trash2 size={13} color="var(--text-muted)" />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{s.filename}</span>
                    <span>{msgCount} turns</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* MAIN CHAT WINDOW */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Messages list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className="animate-in"
                style={{
                  display: 'flex', gap: 14, marginBottom: 24,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  animationDelay: `${i * 0.02}s`,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
                  border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'rgba(16,185,129,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user'
                    ? <User size={16} color="var(--accent-bright)" />
                    : <Bot size={16} color="#10b981" />
                  }
                </div>

                {/* Content area */}
                <div style={{ maxWidth: '78%' }}>
                  {/* AI Source badge */}
                  {msg.role === 'assistant' && msg.source && i > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 12,
                        background: `${SOURCE_CONFIG[msg.source]?.color || '#6366f1'}18`,
                        border: `1px solid ${SOURCE_CONFIG[msg.source]?.color || '#6366f1'}40`,
                      }}>
                        <Brain size={10} color={SOURCE_CONFIG[msg.source]?.color} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: SOURCE_CONFIG[msg.source]?.color }}>
                          {SOURCE_CONFIG[msg.source]?.label}
                        </span>
                      </div>
                      {msg.rag_chunks_used != null && msg.rag_chunks_used > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {msg.rag_chunks_used} file context chunks retrieved
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div style={{
                    background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: msg.role === 'user' ? '16px 6px 16px 16px' : '6px 16px 16px 16px',
                    padding: '16px 20px',
                  }}>
                    {msg.role === 'assistant' ? (
                      <FormattedMarkdownText content={msg.content} />
                    ) : (
                      <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                        {msg.content}
                      </p>
                    )}
                  </div>

                  {/* Key Insight Box */}
                  {msg.key_insight && (
                    <div style={{
                      marginTop: 8, padding: '8px 14px',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 10,
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <Sparkles size={13} color="var(--accent-bright)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <strong>Key Takeaway:</strong> {msg.key_insight}
                      </p>
                    </div>
                  )}

                  {/* Predictions Dropdown */}
                  {msg.predictions && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => setShowPredictions(showPredictions === i ? null : i)}
                        style={{
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          borderRadius: 10, padding: '7px 12px',
                          cursor: 'pointer', width: '100%', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <TrendingUp size={12} color="#10b981" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', flex: 1 }}>
                          Forward-Looking Predictions & Strategic Guidance
                        </span>
                        {showPredictions === i
                          ? <ChevronUp size={12} color="#10b981" />
                          : <ChevronDown size={12} color="#10b981" />
                        }
                      </button>
                      {showPredictions === i && (
                        <div style={{
                          marginTop: 4, padding: '12px 16px',
                          background: 'rgba(16,185,129,0.06)',
                          border: '1px solid rgba(16,185,129,0.2)',
                          borderRadius: '0 0 10px 10px',
                        }}>
                          <FormattedMarkdownText content={msg.predictions} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Data Table Preview */}
                  {msg.data && msg.data.length > 0 && (
                    <div style={{
                      marginTop: 10,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 10, overflow: 'hidden',
                    }}>
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            {Object.keys(msg.data[0]).map(k => (
                              <th key={k}>{k.replace(/_/g, ' ')}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.data.slice(0, 8).map((row: any, ri: number) => (
                            <tr key={ri}>
                              {Object.entries(row).map(([k, v]: any) => (
                                <td key={k} style={{
                                  fontFamily: typeof v === 'number' ? 'var(--font-mono)' : 'var(--font-body)',
                                  fontSize: 12,
                                  color: k === 'revenue' ? '#10b981' : 'var(--text-primary)',
                                  fontWeight: k === 'revenue' ? 700 : 400,
                                }}>
                                  {typeof v === 'number' && k === 'revenue' ? formatCurrency(v) : String(v)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SQL View */}
                  {msg.sql && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => setShowSQL(showSQL === i ? null : i)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5,
                          fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                        }}
                      >
                        <Code size={11} />
                        {showSQL === i ? 'Hide' : 'Show'} SQL Query
                      </button>
                      {showSQL === i && (
                        <pre style={{
                          marginTop: 6, padding: '10px 14px', background: 'var(--bg-primary)',
                          border: '1px solid var(--border)', borderRadius: 8,
                          fontSize: 12, color: '#10b981', fontFamily: 'var(--font-mono)', overflowX: 'auto',
                        }}>
                          {msg.sql}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && !streaming && (
              <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={16} color="#10b981" />
                </div>
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '6px 16px 16px 16px', padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Loader size={14} color="var(--accent-bright)" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Analyzing file context & generating response...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '16px 32px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input-field"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={
                  dataStatus.has_data && dataStatus.active
                    ? `Ask anything about ${dataStatus.filename} (e.g. 'Predict next month revenue', 'Top performers')`
                    : "Upload a file on Dashboard and click 'Start Analysis' to enable AI Chat"
                }
                disabled={loading || !dataStatus.has_data || !dataStatus.active}
              />
              <button
                className="btn-primary"
                onClick={() => send()}
                disabled={loading || !input.trim() || !dataStatus.has_data || !dataStatus.active}
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                <Send size={15} />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR — SUGGESTED QUESTIONS */}
        <div style={{ width: 240, borderLeft: '1px solid var(--border)', padding: 20, background: 'var(--bg-secondary)', overflowY: 'auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Suggested Queries
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SAMPLE_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => send(q)}
                disabled={!dataStatus.has_data || !dataStatus.active}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                  textAlign: 'left', fontSize: 12, color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)', lineHeight: 1.5, transition: 'all 0.2s',
                  opacity: dataStatus.has_data && dataStatus.active ? 1 : 0.5,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {q}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 14, background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Brain size={13} color="var(--accent-bright)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>RAG Conversational AI</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              All responses are grounded directly in your active uploaded file using vector RAG indexing.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
