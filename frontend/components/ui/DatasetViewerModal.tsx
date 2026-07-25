'use client'

import { useState, useEffect } from 'react'
import {
  X, Database, Search, ChevronLeft, ChevronRight, Download,
  FileSpreadsheet, Table, Info, RefreshCw, Sparkles, Check
} from 'lucide-react'
import { getDatasetRows, getDatasetSchema, formatCurrency } from '@/lib/api'

interface DatasetViewerModalProps {
  isOpen: boolean
  onClose: () => void
  filename?: string
}

export default function DatasetViewerModal({ isOpen, onClose, filename }: DatasetViewerModalProps) {
  const [activeTab, setActiveTab] = useState<'rows' | 'schema'>('rows')
  const [rowsData, setRowsData] = useState<any>({ rows: [], total: 0, page: 1, pages: 1, columns: [] })
  const [schemaData, setSchemaData] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadRows(1, search)
      loadSchema()
    }
  }, [isOpen])

  const loadRows = async (p: number, s: string) => {
    setLoading(true)
    try {
      const data = await getDatasetRows(p, 50, s)
      setRowsData(data)
      setPage(data.page || 1)
    } catch (e) {
      console.error('Failed to load dataset rows:', e)
    }
    setLoading(false)
  }

  const loadSchema = async () => {
    try {
      const res = await getDatasetSchema()
      setSchemaData(res.schema || [])
    } catch (e) {
      console.error('Failed to load dataset schema:', e)
    }
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    loadRows(1, val)
  }

  const exportCSV = () => {
    if (!rowsData.rows || rowsData.rows.length === 0) return
    const cols = rowsData.columns
    const csvContent = [
      cols.join(','),
      ...rowsData.rows.map((row: any) =>
        cols.map((col: string) => JSON.stringify(row[col] ?? '')).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${filename || 'uploaded_data'}_preview.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="glass-card animate-in" style={{
        width: '100%', maxWidth: 1100, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        borderRadius: 20, background: 'var(--bg-secondary)',
        border: '1px solid var(--border)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Database size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active Dataset File Content & Schema
                </h2>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(99,102,241,0.15)', color: 'var(--accent-bright)',
                }}>
                  {filename || 'active_session.csv'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Inspect raw rows, verify metrics, filter data, and inspect field data types
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={exportCSV}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12 }}
            >
              <Download size={14} />
              Export Preview CSV
            </button>
            <button
              onClick={onClose}
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab & Search Control Bar */}
        <div style={{
          padding: '12px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          background: 'var(--bg-primary)', flexWrap: 'wrap',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('rows')}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                background: activeTab === 'rows' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'rows' ? 'white' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Table size={14} />
              Data Rows ({rowsData.total.toLocaleString()})
            </button>
            <button
              onClick={() => setActiveTab('schema')}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                background: activeTab === 'schema' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'schema' ? 'white' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <FileSpreadsheet size={14} />
              Columns & Schema ({schemaData.length})
            </button>
          </div>

          {/* Search Box */}
          {activeTab === 'rows' && (
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input
                className="input-field"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search across all fields..."
                style={{ paddingLeft: 34, padding: '7px 12px 7px 34px', fontSize: 13 }}
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeTab === 'rows' ? (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                  Loading file data rows...
                </div>
              ) : rowsData.rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                  No matching rows found in active file dataset.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>#</th>
                        {rowsData.columns.map((col: string) => (
                          <th key={col} style={{ whiteSpace: 'nowrap' }}>
                            {col.replace(/_/g, ' ').toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowsData.rows.map((row: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {(page - 1) * rowsData.limit + idx + 1}
                          </td>
                          {rowsData.columns.map((col: string) => {
                            const val = row[col]
                            const isRevenue = col === 'revenue'
                            return (
                              <td
                                key={col}
                                style={{
                                  whiteSpace: 'nowrap',
                                  fontSize: 12,
                                  fontFamily: typeof val === 'number' ? 'var(--font-mono)' : 'var(--font-body)',
                                  color: isRevenue ? '#10b981' : 'var(--text-primary)',
                                  fontWeight: isRevenue ? 700 : 400,
                                }}
                              >
                                {isRevenue && typeof val === 'number' ? formatCurrency(val) : String(val ?? '')}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* SCHEMA VIEW */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {schemaData.map((col: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: 18, borderRadius: 12,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {col.column}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        background: col.is_numeric ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                        color: col.is_numeric ? '#10b981' : 'var(--accent-bright)',
                      }}>
                        {col.data_type}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <div>Valid entries: <strong>{col.non_null_count}</strong> ({col.null_count} missing)</div>
                      {col.is_numeric && (
                        <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#818cf8' }}>
                          Min: {col.min?.toLocaleString()} · Max: {col.max?.toLocaleString()} · Mean: {col.mean?.toFixed(2)}
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        Samples: {col.sample_values?.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Pagination Bar */}
        {activeTab === 'rows' && (
          <div style={{
            padding: '14px 28px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing Page <strong>{rowsData.page}</strong> of <strong>{rowsData.pages}</strong> ({rowsData.total.toLocaleString()} total rows)
            </span>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={page <= 1}
                onClick={() => loadRows(page - 1, search)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12 }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                disabled={page >= rowsData.pages}
                onClick={() => loadRows(page + 1, search)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12 }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
