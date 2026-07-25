'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, CheckCircle, XCircle, Loader, Wifi, WifiOff,
  Database, Play, Square, RefreshCw, AlertCircle, Eye, ArrowRight, Sparkles, BarChart2, Lightbulb, TrendingUp, MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { startSession, endSession, getUploadStatus, checkBackendHealth } from '@/lib/api'
import { broadcastSessionChange } from '@/lib/useSessionStatus'
import DatasetViewerModal from '@/components/ui/DatasetViewerModal'

interface UploadSectionProps {
  onSessionChange?: () => void
}

export default function UploadSection({ onSessionChange }: UploadSectionProps) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progressStep, setProgressStep] = useState<string | null>(null)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [filePreviewLines, setFilePreviewLines] = useState<string[]>([])
  const [sessionActive, setSessionActive] = useState(false)
  const [showViewerModal, setShowViewerModal] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<{
    filename: string
    rows: number
    columns: string[]
    rag_chunks?: number
  } | null>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // Poll session status & backend health on mount
  const checkStatus = async () => {
    const online = await checkBackendHealth()
    setBackendOnline(online)

    if (online) {
      const status = await getUploadStatus()
      if (status.has_data && status.active) {
        setSessionActive(true)
        setSessionInfo({
          filename: status.filename || 'uploaded_data',
          rows: status.rows || 0,
          columns: status.columns || [],
        })
      } else {
        setSessionActive(false)
        setSessionInfo(null)
      }
    }
  }

  useEffect(() => {
    checkStatus()
    const id = setInterval(checkStatus, 10000)
    return () => clearInterval(id)
  }, [])

  function handleFileSelect(file: File) {
    setErrorMsg(null)
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== 'csv' && ext !== 'xml') {
      setErrorMsg('Only CSV (.csv) and XML (.xml) files are supported.')
      return
    }
    setStagedFile(file)

    // Read first few lines for live file preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 5)
        setFilePreviewLines(lines)
      }
    }
    reader.readAsText(file.slice(0, 4096))
  }

  async function handleStartAnalysis() {
    if (!stagedFile) return
    if (!backendOnline) {
      setErrorMsg('Backend server is offline. Please start uvicorn backend server.')
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setProgressStep('Step 1/3: Reading and parsing file structure...')

    try {
      setTimeout(() => setProgressStep('Step 2/3: Normalizing columns & generating metrics...'), 400)
      setTimeout(() => setProgressStep('Step 3/3: Indexing vectors for AI RAG Chat...'), 900)

      const res = await startSession(stagedFile)

      setSessionActive(true)
      setSessionInfo({
        filename: res.filename || stagedFile.name,
        rows: res.rows || 0,
        columns: res.columns || [],
        rag_chunks: res.rag_chunks || 0,
      })
      setStagedFile(null)
      setFilePreviewLines([])
      if (onSessionChange) onSessionChange()
      broadcastSessionChange()
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to start analysis session.')
    }
    setLoading(false)
    setProgressStep(null)
  }

  async function handleEndAnalysis() {
    setLoading(true)
    setErrorMsg(null)
    try {
      await endSession()
      setSessionActive(false)
      setSessionInfo(null)
      setStagedFile(null)
      setFilePreviewLines([])
      if (onSessionChange) onSessionChange()
      broadcastSessionChange()
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to end session.')
    }
    setLoading(false)
  }

  const statusColor = backendOnline === null ? '#6b7280' : backendOnline ? '#10b981' : '#ef4444'

  return (
    <div className="glass-card animate-in" style={{ padding: 28, marginBottom: 28 }}>
      <DatasetViewerModal
        isOpen={showViewerModal}
        onClose={() => setShowViewerModal(false)}
        filename={sessionInfo?.filename}
      />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Upload size={18} color="var(--accent-bright)" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
            Dataset Media Upload & Analysis Control
          </h2>
        </div>

        {/* Backend status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20,
          background: backendOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${backendOnline ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            boxShadow: backendOnline ? `0 0 6px ${statusColor}` : 'none',
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
            {backendOnline === null ? 'Checking...' : backendOnline ? 'Backend Ready' : 'Backend Offline'}
          </span>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div style={{
          marginBottom: 16, padding: 12, borderRadius: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ef4444',
        }}>
          <AlertCircle size={16} color="#ef4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ACTIVE SESSION VIEW */}
      {sessionActive && sessionInfo ? (
        <div style={{
          padding: 24, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(99,102,241,0.05) 100%)',
          border: '1px solid rgba(16,185,129,0.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'rgba(16,185,129,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 12px rgba(16,185,129,0.3)',
              }}>
                <Database size={24} color="#10b981" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                    boxShadow: '0 0 8px #10b981', display: 'inline-block',
                  }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Active Dataset: {sessionInfo.filename}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: 'rgba(16,185,129,0.2)', color: '#10b981',
                  }}>
                    READY
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {sessionInfo.rows.toLocaleString()} records loaded · {sessionInfo.columns.length} columns detected · Active across Dashboards & AI Chat
                </p>
              </div>
            </div>

            {/* END ANALYSIS BUTTON */}
            <button
              onClick={handleEndAnalysis}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10,
                background: 'rgba(239,68,68,0.15)',
                color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Square size={15} fill="#ef4444" />}
              End Analysis Session
            </button>
          {/* Quick Navigation Hub */}
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(16,185,129,0.2)'
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Explore Dataset:</span>
            <button
              onClick={() => setShowViewerModal(true)}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}
            >
              <Eye size={13} color="#10b981" /> Inspect File Table
            </button>
            <Link href="/dashboard/analytics" style={{ textDecoration: 'none' }}>
              <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
                <BarChart2 size={13} /> Analytics
              </span>
            </Link>
            <Link href="/dashboard/insights" style={{ textDecoration: 'none' }}>
              <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
                <Lightbulb size={13} /> Insights
              </span>
            </Link>
            <Link href="/dashboard/forecasting" style={{ textDecoration: 'none' }}>
              <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
                <TrendingUp size={13} /> Forecast
              </span>
            </Link>
            <Link href="/dashboard/chat" style={{ textDecoration: 'none' }}>
              <span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12 }}>
                <MessageSquare size={13} /> Ask AI Chat
              </span>
            </Link>
          </div>
          </div>
        </div>
      ) : stagedFile ? (
        /* STAGED FILE VIEW — WITH LIVE PREVIEW TABLE */
        <div style={{
          padding: 24, borderRadius: 14,
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'rgba(99,102,241,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={24} color="var(--accent-bright)" />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Selected File: {stagedFile.name}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Size: {(stagedFile.size / 1024).toFixed(1)} KB · Format: {stagedFile.name.split('.').pop()?.toUpperCase()} · Ready for Analysis
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setStagedFile(null); setFilePreviewLines([]); }}
                disabled={loading}
                style={{
                  padding: '9px 14px', borderRadius: 10,
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer',
                }}
              >
                Change File
              </button>

              <button
                onClick={handleStartAnalysis}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 22px', borderRadius: 10,
                  background: 'var(--accent)', color: 'white',
                  border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                }}
              >
                {loading ? <Loader size={16} className="animate-spin" /> : <Play size={16} fill="white" />}
                {loading ? 'Processing...' : '🚀 Start Analysis'}
              </button>
            </div>
          </div>

          {/* Processing Indicator */}
          {loading && progressStep && (
            <div style={{
              margin: '14px 0', padding: 12, borderRadius: 10,
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--accent-bright)', fontWeight: 600
            }}>
              <Loader size={16} className="animate-spin" />
              <span>{progressStep}</span>
            </div>
          )}

          {/* LIVE FILE PREVIEW TABLE */}
          {filePreviewLines.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                <Eye size={14} color="var(--accent-bright)" />
                LIVE FILE DATA PREVIEW (FIRST FEW ROWS):
              </div>
              <div style={{
                background: 'var(--bg-secondary)', padding: 12, borderRadius: 10, border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', overflowX: 'auto', maxHeight: 120
              }}>
                {filePreviewLines.map((line, idx) => (
                  <div key={idx} style={{
                    whiteSpace: 'nowrap', padding: '2px 0',
                    borderBottom: idx === 0 ? '1px solid var(--border)' : 'none',
                    fontWeight: idx === 0 ? 700 : 400,
                    color: idx === 0 ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* DROP ZONE FOR SELECTING A FILE */
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFileSelect(file)
          }}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 14,
            padding: '38px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.02)',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xml"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 16,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.15)'
            }}>
              <FileText size={28} color="var(--accent-bright)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>
                Drop CSV or XML file here, or click to browse
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                Upload your dataset file to generate analytics, insights, forecasting, and enable AI Chat
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {['CSV', 'XML'].map(f => (
                <span key={f} style={{
                  padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(99,102,241,0.12)', color: 'var(--accent-bright)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}>{f}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
