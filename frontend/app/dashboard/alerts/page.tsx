'use client'

import { useState, useRef } from 'react'
import Header from '@/components/layout/Header'
import { compareDatasets, formatCurrency } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import { Upload, GitCompareArrows, TrendingUp, TrendingDown, Minus, Loader2, FileText, Sparkles } from 'lucide-react'

type Gap = '1m' | '3m' | '1yr'

const GAP_OPTIONS: { value: Gap; label: string; desc: string }[] = [
  { value: '1m', label: '1 Month', desc: 'Compare month over month' },
  { value: '3m', label: '3 Months', desc: 'Quarterly comparison' },
  { value: '1yr', label: '1 Year', desc: 'Year over year analysis' },
]

const COLORS_OLD = ['#6366f1', '#818cf8', '#a78bfa', '#7c3aed', '#4f46e5']
const COLORS_NEW = ['#10b981', '#34d399', '#059669', '#06b6d4', '#0891b2']

function FileDropZone({
  label, file, onFile,
}: { label: string; file: File | null; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        flex: 1,
        minHeight: 180,
        border: `2px dashed ${dragging ? '#6366f1' : file ? '#10b981' : 'var(--border)'}`,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        padding: 28,
        transition: 'all 0.2s',
        background: dragging
          ? 'rgba(99,102,241,0.08)'
          : file
          ? 'rgba(16,185,129,0.06)'
          : 'rgba(255,255,255,0.02)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xml"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: file ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {file ? <FileText size={24} color="#10b981" /> : <Upload size={24} color="var(--accent-bright)" />}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
        {file ? (
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ {file.name}</div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Drop CSV / XML here or click to browse</div>
        )}
      </div>
    </div>
  )
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
  const up = pct > 0
  const Icon = up ? TrendingUp : pct < 0 ? TrendingDown : Minus
  const color = up ? '#10b981' : pct < 0 ? '#ef4444' : '#94a3b8'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontWeight: 700, fontSize: 14 }}>
      <Icon size={14} />
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function SummaryCard({ label, oldVal, newVal, change, prefix = '$' }: any) {
  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>OLD</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', fontFamily: 'var(--font-mono)' }}>
            {prefix}{typeof oldVal === 'number' ? oldVal >= 1000 ? formatCurrency(oldVal).replace('$','') : oldVal.toFixed(1) : oldVal}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>NEW</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
            {prefix}{typeof newVal === 'number' ? newVal >= 1000 ? formatCurrency(newVal).replace('$','') : newVal.toFixed(1) : newVal}
          </div>
        </div>
      </div>
      <ChangeBadge pct={change} />
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.fill, fontWeight: 600 }}>{p.name}: {formatCurrency(p.value)}</p>
        ))}
      </div>
    )
  }
  return null
}

export default function ComparePage() {
  const [fileOld, setFileOld] = useState<File | null>(null)
  const [fileNew, setFileNew] = useState<File | null>(null)
  const [gap, setGap] = useState<Gap>('3m')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const canCompare = fileOld && fileNew && !loading

  const handleCompare = async () => {
    if (!fileOld || !fileNew) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await compareDatasets(fileOld, fileNew, gap)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Comparison failed')
    }
    setLoading(false)
  }

  // Build grouped bar data for location + category
  const locationChartData = result?.by_location?.slice(0, 10).map((r: any) => ({
    name: r.location?.length > 12 ? r.location.slice(0, 12) + '…' : r.location,
    Old: r.old,
    New: r.new,
  })) || []

  const categoryChartData = result?.by_category?.slice(0, 10).map((r: any) => ({
    name: r.category?.length > 12 ? r.category.slice(0, 12) + '…' : r.category,
    Old: r.old,
    New: r.new,
  })) || []

  return (
    <div>
      <Header
        title="Dataset Comparison"
        subtitle="Upload two datasets and compare revenue performance side-by-side"
      />
      <div style={{ padding: 32 }}>

        {/* Upload + Config Panel */}
        <div className="glass-card animate-in" style={{ padding: 28, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <GitCompareArrows size={22} color="var(--accent-bright)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Compare Two Datasets
            </h2>
          </div>

          {/* File Upload Zones */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 28 }}>
            <FileDropZone label="📂 Old Dataset (Baseline)" file={fileOld} onFile={setFileOld} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GitCompareArrows size={18} color="white" />
              </div>
            </div>
            <FileDropZone label="📂 New Dataset (Current)" file={fileNew} onFile={setFileNew} />
          </div>

          {/* Time Gap Selector */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Time Gap Between Datasets
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {GAP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setGap(opt.value)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: `2px solid ${gap === opt.value ? '#6366f1' : 'var(--border)'}`,
                    background: gap === opt.value ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: gap === opt.value ? 'var(--accent-bright)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  <div>{opt.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Compare Button */}
          <button
            onClick={handleCompare}
            disabled={!canCompare}
            style={{
              padding: '13px 32px',
              borderRadius: 12,
              border: 'none',
              background: canCompare
                ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                : 'rgba(99,102,241,0.3)',
              color: 'white',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              cursor: canCompare ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.2s',
              boxShadow: canCompare ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
            }}
          >
            {loading ? (
              <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Comparing datasets…</>
            ) : (
              <><GitCompareArrows size={18} /> Compare Datasets</>
            )}
          </button>

          {!fileOld || !fileNew ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              ↑ Upload both datasets above to enable comparison
            </p>
          ) : null}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: 16, borderRadius: 12, marginBottom: 24,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: 14,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Summary KPI Cards */}
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                📊 Revenue Summary
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <SummaryCard
                  label="Total Revenue"
                  oldVal={result.summary.total_revenue_old}
                  newVal={result.summary.total_revenue_new}
                  change={result.summary.revenue_change_pct}
                />
                <SummaryCard
                  label="Avg Revenue / Record"
                  oldVal={result.summary.avg_revenue_old}
                  newVal={result.summary.avg_revenue_new}
                  change={result.summary.avg_revenue_change_pct}
                />
                <SummaryCard
                  label="Total Records"
                  oldVal={result.summary.records_old}
                  newVal={result.summary.records_new}
                  change={result.summary.records_change_pct}
                  prefix=""
                />
                {result.summary.avg_rating_old !== null && (
                  <SummaryCard
                    label="Avg Rating"
                    oldVal={result.summary.avg_rating_old}
                    newVal={result.summary.avg_rating_new}
                    change={null}
                    prefix=""
                  />
                )}
              </div>
            </div>

            {/* By Location Chart */}
            {locationChartData.length > 0 && (
              <div className="glass-card animate-in" style={{ padding: 28 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
                  📍 Revenue by Location — Old vs New
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={locationChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(v: string) => (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {v === 'Old' ? `📂 Old (${result.files?.old || 'baseline'})` : `📂 New (${result.files?.new || 'current'})`}
                        </span>
                      )}
                    />
                    <Bar dataKey="Old" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="New" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Location change table */}
                <div style={{ marginTop: 20, overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Old Revenue</th>
                        <th>New Revenue</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.by_location.slice(0, 10).map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{r.location}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#818cf8' }}>{formatCurrency(r.old)}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>{formatCurrency(r.new)}</td>
                          <td><ChangeBadge pct={r.change_pct} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* By Category Chart */}
            {categoryChartData.length > 0 && (
              <div className="glass-card animate-in" style={{ padding: 28 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
                  🍽️ Revenue by Category — Old vs New
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(v: string) => (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {v === 'Old' ? '📂 Old' : '📂 New'}
                        </span>
                      )}
                    />
                    <Bar dataKey="Old" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="New" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Performers Comparison */}
            {(result.top_old?.length > 0 || result.top_new?.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {result.top_old?.length > 0 && (
                  <div className="glass-card animate-in" style={{ padding: 24 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#818cf8', marginBottom: 16 }}>
                      📂 Top Performers — Old Dataset
                    </h3>
                    <table className="data-table">
                      <thead><tr><th>#</th><th>Name</th><th>Revenue</th></tr></thead>
                      <tbody>
                        {result.top_old.slice(0, 8).map((r: any, i: number) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{i+1}</td>
                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>{formatCurrency(r.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {result.top_new?.length > 0 && (
                  <div className="glass-card animate-in" style={{ padding: 24 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#10b981', marginBottom: 16 }}>
                      📂 Top Performers — New Dataset
                    </h3>
                    <table className="data-table">
                      <thead><tr><th>#</th><th>Name</th><th>Revenue</th></tr></thead>
                      <tbody>
                        {result.top_new.slice(0, 8).map((r: any, i: number) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{i+1}</td>
                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: '#10b981', fontWeight: 700 }}>{formatCurrency(r.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* AI Conclusion */}
            {result.conclusion && (
              <div className="glass-card animate-in" style={{
                padding: 28,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1, #10b981)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={20} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                      AI Analysis & Conclusion
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Generated by RevenueRadar AI</p>
                  </div>
                </div>
                <div style={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: 'var(--text-secondary)',
                }}>
                  <div className="markdown-body" style={{ whiteSpace: 'pre-wrap' }}>
                    {result.conclusion}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .markdown-body h2 { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 16px 0 8px; }
        .markdown-body h3 { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--accent-bright); margin: 14px 0 6px; }
        .markdown-body strong { color: var(--text-primary); font-weight: 700; }
        .markdown-body ul { padding-left: 20px; margin: 8px 0; }
        .markdown-body li { margin-bottom: 4px; }
        .markdown-body p { margin-bottom: 10px; }
      `}</style>
    </div>
  )
}
