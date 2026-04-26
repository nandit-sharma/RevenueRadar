'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader } from 'lucide-react'
import { uploadCSV } from '@/lib/api'

interface UploadResult {
  success: boolean
  message: string
  rows?: number
  columns?: string[]
}

export default function UploadSection() {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setResult(null)
    try {
      const res = await uploadCSV(file)
      setResult({ success: true, message: res.message, rows: res.rows, columns: res.columns })
    } catch (e: any) {
      setResult({ success: false, message: 'Failed to upload file. Please check format and try again.' })
    }
    setLoading(false)
  }

  return (
    <div className="glass-card animate-in" style={{ padding: 28, marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Upload size={18} color="var(--accent-bright)" />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
          Import Revenue Data
        </h2>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: '36px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(99,102,241,0.08)' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader size={32} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Processing your CSV...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={26} color="var(--accent-bright)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>
                Drop CSV file here or click to browse
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                Supports restaurant/sales data with revenue columns
              </p>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 10,
          background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          {result.success
            ? <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
            : <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          }
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: result.success ? '#10b981' : '#ef4444' }}>
              {result.message}
            </p>
            {result.rows && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {result.rows} records imported · {result.columns?.length} columns detected
              </p>
            )}
            {result.columns && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Columns: {result.columns.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sample format hint */}
      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <span style={{ fontWeight: 600 }}>Expected columns: </span>
        name, location, cuisine, rating, revenue, marketing_budget, service_quality_score, ...
      </div>
    </div>
  )
}
