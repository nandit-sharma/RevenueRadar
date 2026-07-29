'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings2, ChevronDown, Check } from 'lucide-react'

interface ColumnSelectorProps {
  columns: string[]
  value: string
  onChange: (col: string) => void
  label?: string
}

export default function ColumnSelector({ columns, value, onChange, label = 'Value column' }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!columns || columns.length === 0) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={`${label}: ${value}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: open ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-body)',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <Settings2 size={13} color="var(--accent-bright)" />
        <span style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>{value}</span>
        <ChevronDown
          size={12}
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', opacity: 0.6 }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 200,
            minWidth: 180,
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '6px 0',
          }}
        >
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            padding: '4px 12px 6px',
          }}>
            {label}
          </div>
          {columns.map(col => (
            <button
              key={col}
              onClick={() => { onChange(col); setOpen(false) }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '7px 12px',
                background: col === value ? 'rgba(99,102,241,0.12)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: col === value ? 'var(--accent-bright)' : 'var(--text-secondary)',
                fontWeight: col === value ? 600 : 400,
                fontFamily: 'var(--font-body)',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (col !== value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (col !== value) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{col}</span>
              {col === value && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
