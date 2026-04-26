'use client'

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: LucideIcon
  accent?: string
  delay?: number
}

export default function KPICard({ title, value, change, changeLabel, icon: Icon, accent = '#6366f1', delay = 0 }: KPICardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div
      className="glass-card animate-in"
      style={{
        padding: 24,
        animationDelay: `${delay}s`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow */}
      <div style={{
        position: 'absolute',
        top: -30,
        right: -30,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: `${accent}15`,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          {title}
        </p>
        <div style={{
          width: 36, height: 36,
          background: `${accent}20`,
          border: `1px solid ${accent}40`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} color={accent} />
        </div>
      </div>

      <div className="metric-value" style={{ color: 'var(--text-primary)', marginBottom: 10 }}>
        {value}
      </div>

      {change !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`stat-badge ${isPositive ? 'up' : isNegative ? 'down' : 'neutral'}`}>
            {isPositive ? <TrendingUp size={11} /> : isNegative ? <TrendingDown size={11} /> : <Minus size={11} />}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {changeLabel || 'vs last period'}
          </span>
        </div>
      )}
    </div>
  )
}
