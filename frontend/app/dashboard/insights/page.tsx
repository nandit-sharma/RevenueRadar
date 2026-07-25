'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { useSessionStatus } from '@/lib/useSessionStatus'
import NoDataState from '@/components/ui/NoDataState'
import { getDrivers, getSeasonalPatterns, formatCurrency } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2, ArrowRight } from 'lucide-react'

const FEATURE_NAME_MAP: Record<string, string> = {
  seating_capacity: 'Seating Capacity',
  num_reviews: 'Customer Reviews Count',
  service_quality_score: 'Service Quality Score',
  chef_experience_years: 'Chef Experience (Years)',
  marketing_budget: 'Marketing & Ad Spend',
  weekend_reservations: 'Weekend Reservations',
  weekday_reservations: 'Weekday Reservations',
  avg_meal_price: 'Average Item / Meal Price',
  ambience_score: 'Ambience Rating',
  rating: 'Customer Rating',
  social_media_followers: 'Social Media Reach',
}

function formatFeatureName(feat: string): string {
  if (FEATURE_NAME_MAP[feat]) return FEATURE_NAME_MAP[feat]
  return feat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const IMPACT_COLORS: Record<string, string> = {
  High: '#10b981',
  Medium: '#f59e0b',
  Low: '#6366f1',
}

export default function InsightsPage() {
  const session = useSessionStatus()
  const [drivers, setDrivers] = useState<any[]>([])
  const [seasonal, setSeasonal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([getDrivers(), getSeasonalPatterns()])
      setDrivers(d)
      setSeasonal(s)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [session.hasData, session.active])

  const hasData = drivers.length > 0 || seasonal.length > 0

  const topPositiveDriver = drivers.find(d => d.direction === 'positive')
  const topNegativeDriver = drivers.find(d => d.direction === 'negative')

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>{formatFeatureName(label)}</p>
          <p style={{ color: '#818cf8', fontWeight: 600 }}>Correlation Strength: {payload[0].value}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <Header title="Revenue Insights & Growth Drivers" subtitle="Understand what factors drive your revenue up or down" onRefresh={loadData} />
      <div style={{ padding: 32 }}>
        {!loading && !hasData ? (
          <NoDataState
            title="No Data Available for Insights"
            description="Revenue driver discovery and seasonal pattern analysis require an active dataset session. Upload a CSV or XML file below or via the top header."
          />
        ) : (
          <>
            {/* PLAIN ENGLISH EXECUTIVE TAKEAWAYS */}
            <div className="glass-card animate-in" style={{
              padding: 24, marginBottom: 28, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(99,102,241,0.06) 100%)',
              border: '1px solid rgba(16,185,129,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Sparkles size={22} color="#10b981" />
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Executive Growth Summary & Action Plan
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 12 }}>
                {topPositiveDriver && (
                  <div style={{
                    padding: 16, borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
                    display: 'flex', gap: 12,
                  }}>
                    <TrendingUp size={22} color="#10b981" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>#1 Primary Revenue Growth Driver</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                        {formatFeatureName(topPositiveDriver.feature)}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                        Increasing <strong>{formatFeatureName(topPositiveDriver.feature)}</strong> shows a strong direct link to higher overall revenue. Focus investment here for max return.
                      </p>
                    </div>
                  </div>
                )}

                {topNegativeDriver ? (
                  <div style={{
                    padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                    display: 'flex', gap: 12,
                  }}>
                    <AlertTriangle size={22} color="#ef4444" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>Area Requiring Optimization</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                        {formatFeatureName(topNegativeDriver.feature)}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                        High levels of <strong>{formatFeatureName(topNegativeDriver.feature)}</strong> correlate with lower margins. Review operational efficiency in this area.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: 16, borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
                    display: 'flex', gap: 12,
                  }}>
                    <Lightbulb size={22} color="var(--accent-bright)" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-bright)', textTransform: 'uppercase' }}>Balanced Performance</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>Positive Metric Synergy</div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                        All evaluated factors show positive impact on revenue. Maintaining quality across branches will sustain steady growth.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Strategic Action Tips */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Lightbulb size={16} color="var(--accent-bright)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    AI Recommended Next Steps ("What Should I Do Next?")
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>STEP 1: EXPAND HIGH-IMPACT DRIVERS</div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Reallocate 15% of underperforming budget directly into <strong>{topPositiveDriver ? formatFeatureName(topPositiveDriver.feature) : 'Top Drivers'}</strong>.
                    </p>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8' }}>STEP 2: QUERY AI CHAT FOR SPECIFICS</div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Ask AI Chat: <em>&quot;Which branch has the highest {topPositiveDriver ? formatFeatureName(topPositiveDriver.feature) : 'performance'}?&quot;</em> to target expansion.
                    </p>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>STEP 3: MONITOR ANOMALIES</div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Check the <strong>Alerts</strong> tab to verify if any unit has fallen &gt;1.5 standard deviations below average revenue.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Drivers Chart & Explanation */}
            {drivers.length > 0 && (
              <div className="glass-card animate-in" style={{ padding: 28, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                      What Drives Your Revenue Most?
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Factors ranked by their power to increase revenue (higher score = stronger impact)
                    </p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={drivers.map(d => ({ ...d, displayName: formatFeatureName(d.feature) }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={11} domain={[0, 1]} />
                    <YAxis type="category" dataKey="displayName" stroke="var(--text-muted)" fontSize={12} width={170} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="correlation" radius={[0, 6, 6, 0]}>
                      {drivers.map((entry, index) => (
                        <Cell key={index} fill={entry.direction === 'positive' ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Driver cards table */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 24 }}>
                  {drivers.slice(0, 6).map((d, i) => (
                    <div key={i} style={{
                      padding: 14, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatFeatureName(d.feature)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          Impact: <span style={{ color: IMPACT_COLORS[d.impact] || '#818cf8', fontWeight: 600 }}>{d.impact}</span>
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: d.direction === 'positive' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: d.direction === 'positive' ? '#10b981' : '#ef4444',
                      }}>
                        {d.direction === 'positive' ? '↑ Positive Link' : '↓ Negative Link'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seasonal Patterns */}
            {seasonal.length > 0 && (
              <div className="glass-card animate-in" style={{ padding: 28 }}>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Seasonal Sales Pattern
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Average sales by month across the year (helps plan inventory & marketing campaigns)
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={seasonal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                    <XAxis dataKey="month_name" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
