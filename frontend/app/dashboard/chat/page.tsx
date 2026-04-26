'use client'

import { useState, useRef, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { chatQuery, formatCurrency } from '@/lib/api'
import { Send, Bot, User, Sparkles, Code, BarChart2, Loader } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  data?: any[]
  sql?: string
  confidence?: number
  key_insight?: string
}

const SAMPLE_QUESTIONS = [
  "Which cuisine generates the highest revenue?",
  "What are the top 5 restaurants by revenue?",
  "Does marketing budget impact revenue?",
  "Which location performs best?",
  "What is the average rating?",
  "Show me total revenue",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your RevenueRadar AI analyst. Ask me anything about your revenue data — I can analyze trends, identify top performers, explain patterns, and answer questions in plain English.",
      confidence: 1,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSQL, setShowSQL] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const res = await chatQuery(msg, history)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        data: res.data,
        sql: res.sql,
        confidence: res.confidence,
        key_insight: res.key_insight,
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't process that query. Please make sure the backend is running and try again.",
      }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header title="AI Revenue Assistant" subtitle="Natural language queries powered by AI" />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className="animate-in"
                style={{
                  display: 'flex',
                  gap: 14,
                  marginBottom: 20,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  animationDelay: `${i * 0.02}s`,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
                  border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'rgba(16,185,129,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user'
                    ? <User size={16} color="var(--accent-bright)" />
                    : <Bot size={16} color="#10b981" />
                  }
                </div>

                {/* Bubble */}
                <div style={{ maxWidth: '70%' }}>
                  <div style={{
                    background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: msg.role === 'user' ? '16px 6px 16px 16px' : '6px 16px 16px 16px',
                    padding: '14px 18px',
                  }}>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      {msg.content}
                    </p>
                  </div>

                  {/* Key insight */}
                  {msg.key_insight && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 14px',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 10,
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <Sparkles size={13} color="var(--accent-bright)" style={{ marginTop: 1, flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{msg.key_insight}</p>
                    </div>
                  )}

                  {/* Data table */}
                  {msg.data && msg.data.length > 0 && (
                    <div style={{
                      marginTop: 10,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      overflow: 'hidden',
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

                  {/* SQL */}
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
                        {showSQL === i ? 'Hide' : 'Show'} SQL query
                      </button>
                      {showSQL === i && (
                        <pre style={{
                          marginTop: 6, padding: '10px 14px', background: 'var(--bg-primary)',
                          border: '1px solid var(--border)', borderRadius: 8,
                          fontSize: 12, color: '#10b981', fontFamily: 'var(--font-mono)', overflowX: 'auto',
                        }}>{msg.sql}</pre>
                      )}
                    </div>
                  )}

                  {/* Confidence */}
                  {msg.confidence !== undefined && msg.role === 'assistant' && i > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ height: 3, width: 60, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${msg.confidence * 100}%`, background: '#10b981', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {Math.round(msg.confidence * 100)}% confidence
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={16} color="#10b981" />
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px 16px 16px 16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader size={14} color="var(--accent-bright)" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Analyzing your data...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '16px 32px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input-field"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about your revenue data... (e.g. 'Which cuisine performs best?')"
                disabled={loading}
              />
              <button
                className="btn-primary"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                <Send size={15} />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 240, borderLeft: '1px solid var(--border)', padding: 20, background: 'var(--bg-secondary)', overflowY: 'auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Sample Questions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SAMPLE_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => send(q)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                  textAlign: 'left', fontSize: 12, color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)', lineHeight: 1.5, transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {q}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 14, background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <BarChart2 size={13} color="var(--accent-bright)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>AI Analyst</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Powered by natural language processing. Ask in plain English — no SQL needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
