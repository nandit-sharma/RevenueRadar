'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { getDrivers, getSeasonalPatterns } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'

const IMPACT_COLORS: Record<string, string> = {
  High: '#10b981',
  Medium: '#f59e0b',
  Low: '#6366f1',
}

const DIRECTION_COLORS: Record<string, string> = {
  positive: '#10b981',
  negative: '#ef4444',
}

export default function InsightsPage() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [seasonal, setSeasonal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDrivers(), getSeasonalPatterns()])
      .then(([d, s]) => { setDrivers(d); setSeasonal(s) })
      .finally(() => setLoading(false))
  }, [])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
          <p style={{ color: '#818cf8', fontWeight: 600 }}>Correlation: {payload[0].value}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <Header title="Revenue Insights" subtitle="Understand what drives your revenue performance" />
      <div style={{ padding: 32 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading insights...</div>
        ) : (
          <>
            {/* Key Drivers */}
            <div className="glass-card animate-in" style={{ padding: 28, marginBottom: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Revenue Drivers
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Features ranked by correlation strength with revenue
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  {drivers.map((d: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 0',
                      borderBottom: i < drivers.length - 1 ? '1px solid rgba(99,102,241,0.08)' : 'none',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: DIRECTION_COLORS[d.direction] || '#6366f1',
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                            {d.feature.replace(/_/g, ' ')}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
                            background: `${IMPACT_COLORS[d.impact]}20`,
                            color: IMPACT_COLORS[d.impact],
                          }}>{d.impact}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(99,102,241,0.1)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${d.correlation * 100}%`,
                            background: DIRECTION_COLORS[d.direction] || '#6366f1',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {d.direction} impact
                          </span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            r = {d.correlation}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={drivers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} stroke="var(--text-muted)" fontSize={11} />
                    <YAxis type="category" dataKey="feature" stroke="var(--text-muted)" fontSize={11} width={130}
                      tickFormatter={(v: string) => v.replace(/_/g, ' ')} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="correlation" radius={[0, 6, 6, 0]}>
                      {drivers.map((d: any, i: number) => (
                        <Cell key={i} fill={IMPACT_COLORS[d.impact] || '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Seasonal Patterns */}
            {seasonal.length > 0 && (
              <div className="glass-card animate-in animate-in-delay-2" style={{ padding: 28, marginBottom: 24 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Seasonal Revenue Patterns
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Average monthly revenue showing seasonal peaks and troughs
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={seasonal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                    <XAxis dataKey="month_name" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Avg Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#a78bfa" strokeWidth={3}
                      dot={{ fill: '#a78bfa', r: 5 }} activeDot={{ r: 7, fill: '#818cf8' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Insights cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {drivers.slice(0, 3).map((d: any, i: number) => (
                <div key={i} className="glass-card animate-in" style={{ padding: 20, animationDelay: `${0.1 * i}s` }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: IMPACT_COLORS[d.impact], marginBottom: 8,
                  }}>
                    {d.impact} Impact Driver
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize', marginBottom: 8 }}>
                    {d.feature.replace(/_/g, ' ')}
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    This factor has a <strong style={{ color: DIRECTION_COLORS[d.direction] }}>{d.direction}</strong> correlation of{' '}
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-bright)' }}>{d.correlation}</strong> with revenue.
                    {d.direction === 'positive' ? ' Increasing this drives higher earnings.' : ' Reducing this may help revenue.'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
