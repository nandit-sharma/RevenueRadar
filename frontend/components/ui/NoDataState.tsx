'use client'

import React, { useState, useRef } from 'react'
import { Database, Upload, FileText, Loader, Play, AlertCircle } from 'lucide-react'
import { startSession } from '@/lib/api'
import { broadcastSessionChange } from '@/lib/useSessionStatus'

interface NoDataStateProps {
  title?: string
  description?: string
  showUploadButton?: boolean
  onUploadClick?: () => void
}

export default function NoDataState({
  title = "No Active Analysis Session",
  description = "No dataset is currently loaded. Select or drag & drop a CSV or XML file below to start analysis across all pages & AI Chat.",
  showUploadButton = true,
}: NoDataStateProps) {
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(file: File) {
    setErrorMsg(null)
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== 'csv' && ext !== 'xml') {
      setErrorMsg('Only CSV (.csv) and XML (.xml) files are supported.')
      return
    }
    setStagedFile(file)
  }

  async function handleStartAnalysis() {
    if (!stagedFile) return
    setLoading(true)
    setErrorMsg(null)
    try {
      await startSession(stagedFile)
      setStagedFile(null)
      broadcastSessionChange()
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to start analysis session.')
    }
    setLoading(false)
  }

  return (
    <div className="glass-card animate-in" style={{
      padding: '40px 28px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '20px 0',
      borderRadius: 16,
      border: '1px dashed var(--border)',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 16,
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <Database size={28} color="var(--accent-bright)" />
      </div>

      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 8,
      }}>
        {title}
      </h3>

      <p style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        maxWidth: 520,
        lineHeight: 1.6,
        marginBottom: 20,
      }}>
        {description}
      </p>

      {errorMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ef4444',
        }}>
          <AlertCircle size={15} color="#ef4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {showUploadButton && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          {stagedFile ? (
            <div style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                <FileText size={20} color="var(--accent-bright)" />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{stagedFile.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{(stagedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStagedFile(null)}
                  disabled={loading}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartAnalysis}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} fill="white" />}
                  Start Analysis
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFileSelect(f)
              }}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: '24px 16px',
                cursor: 'pointer',
                background: dragging ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.03)',
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xml"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
              <Upload size={22} color="var(--accent-bright)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Click to browse or drop CSV/XML file here
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Upload dataset directly from this page to start analysis
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
