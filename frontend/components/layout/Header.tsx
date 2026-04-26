'use client'

import { useState, useEffect } from 'react'
import { Filter, RefreshCw, Download, Bell } from 'lucide-react'
import { getFilterOptions } from '@/lib/api'

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
  const [options, setOptions] = useState<{ locations: string[], cuisines: string[] }>({
    locations: [], cuisines: []
  })
  const [showFilters, setShowFilters] = useState(false)

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
