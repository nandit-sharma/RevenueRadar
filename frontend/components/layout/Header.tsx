'use client'

import { useState, useEffect, useRef } from 'react'
import { Filter, RefreshCw, Download, Bell, Upload, Database, Eye } from 'lucide-react'
import { getFilterOptions, startSession } from '@/lib/api'
import { broadcastSessionChange, useSessionStatus } from '@/lib/useSessionStatus'
import DatasetViewerModal from '@/components/ui/DatasetViewerModal'

interface FilterState {
  location: string
  cuisine: string
}

interface HeaderProps {
  title: string
  subtitle?: string
  filters?: FilterState
  onFiltersChange?: (filters: FilterState) => void
  onRefresh?: () => void
}

export default function Header({ title, subtitle, filters, onFiltersChange, onRefresh }: HeaderProps) {
  const session = useSessionStatus()
  const [options, setOptions] = useState<{ locations: string[], cuisines: string[] }>({
    locations: [], cuisines: []
  })
  const [showFilters, setShowFilters] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showViewerModal, setShowViewerModal] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getFilterOptions().then(setOptions).catch(() => {})
  }, [])

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <header style={{
      padding: '20px 32px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <DatasetViewerModal
        isOpen={showViewerModal}
        onClose={() => setShowViewerModal(false)}
        filename={session.filename}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{now}</span>

          {/* Inspect File Data Button */}
          {session.hasData && session.active && (
            <button
              onClick={() => setShowViewerModal(true)}
              className="btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12,
                background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)',
                fontWeight: 600,
              }}
              title="Inspect raw uploaded file rows & schema"
            >
              <Eye size={14} color="#10b981" />
              <span>Inspect Active Data ({session.rows.toLocaleString()})</span>
            </button>
          )}


          {/* Quick Upload Button */}
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13 }}
          >
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload Data'}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".csv,.xml"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploading(true)
              try {
                await startSession(file)
                broadcastSessionChange()
                if (onRefresh) onRefresh()
              } catch (err: any) {
                alert(err.message || 'Failed to upload file')
              }
              setUploading(false)
            }}
          />

          {onFiltersChange && (
            <button
              className="btn-secondary"
              onClick={() => setShowFilters(!showFilters)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
            >
              <Filter size={14} />
              Filters
            </button>
          )}

          {onRefresh && (
            <button className="btn-secondary" onClick={onRefresh} style={{ padding: '8px 12px' }}>
              <RefreshCw size={14} />
            </button>
          )}

          <div style={{
            width: 36, height: 36,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
          }}>
            <Bell size={15} color="var(--accent-bright)" />
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 6, height: 6,
              background: '#ef4444',
              borderRadius: '50%',
            }} />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && onFiltersChange && filters && (
        <div style={{
          marginTop: 16,
          padding: 16,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</label>
            <select
              className="input-field"
              value={filters.location}
              onChange={e => onFiltersChange({ ...filters, location: e.target.value })}
              style={{ padding: '7px 12px' }}
            >
              <option value="">All Locations</option>
              {options.locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cuisine</label>
            <select
              className="input-field"
              value={filters.cuisine}
              onChange={e => onFiltersChange({ ...filters, cuisine: e.target.value })}
              style={{ padding: '7px 12px' }}
            >
              <option value="">All Cuisines</option>
              {options.cuisines.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn-secondary"
              onClick={() => onFiltersChange({ location: '', cuisine: '' })}
              style={{ padding: '7px 14px', fontSize: 13 }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
