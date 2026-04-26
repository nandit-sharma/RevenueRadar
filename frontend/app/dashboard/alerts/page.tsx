'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { getAlerts, formatCurrency } from '@/lib/api'
import { AlertTriangle, TrendingDown, TrendingUp, MapPin, Calendar, RefreshCw } from 'lucide-react'

const SEVERITY_CONFIG: Record<string, { color: string, bg: string, border: string }> = {
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  low: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
}

const TYPE_ICONS: Record<string, any> = {
  revenue_drop: TrendingDown,
  revenue_spike: TrendingUp,
  underperforming_location: MapPin,
  low_reservations: Calendar,
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const res = await getAlerts()
      setAlerts(res)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadAlerts() }, [])

  const allAlerts = alerts ? [...(alerts.auto_detected || []), ...(alerts.custom || [])] : []

  const countBySeverity = (s: string) => allAlerts.filter((a: any) => a.severity === s).length

  return (
    <div>
      <Header title="Alerts & Anomalies" subtitle="Auto-detected revenue anomalies and performance warnings" onRefresh={loadAlerts} />
      <div style={{ padding: 32 }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Alerts', value: allAlerts.length, color: '#6366f1' },
            { label: 'High Severity', value: countBySeverity('high'), color: '#ef4444' },
            { label: 'Medium Severity', value: countBySeverity('medium'), color: '#f59e0b' },
            { label: 'Low Severity', value: countBySeverity('low'), color: '#10b981' },
          ].map((item, i) => (
            <div key={i} className="glass-card animate-in" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{item.label}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Alert List */}
        <div className="glass-card animate-in animate-in-delay-2" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Active Alerts
            </h3>
            <button className="btn-secondary" onClick={loadAlerts} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 13 }}>
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Scanning for anomalies...</div>
          ) : allAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>No anomalies detected. Revenue is on track!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allAlerts.map((alert: any, i: number) => {
                const conf = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low
                const Icon = TYPE_ICONS[alert.type] || AlertTriangle
                return (
                  <div
                    key={i}
                    className="animate-in"
                    style={{
                      padding: '16px 20px',
                      background: conf.bg,
                      border: `1px solid ${conf.border}`,
                      borderRadius: 12,
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      animationDelay: `${i * 0.04}s`,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${conf.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={18} color={conf.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          padding: '2px 8px', borderRadius: 100,
                          background: `${conf.color}25`, color: conf.color,
                        }}>
                          {alert.severity}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {alert.type?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {alert.message}
                      </p>
                      {alert.value !== undefined && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>
                          Actual: <span style={{ fontFamily: 'var(--font-mono)', color: conf.color }}>{formatCurrency(alert.value)}</span>
                          {alert.expected !== undefined && (
                            <> · Expected: <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(alert.expected)}</span></>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
