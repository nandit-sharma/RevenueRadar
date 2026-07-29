'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { useSessionStatus } from '@/lib/useSessionStatus'
import NoDataState from '@/components/ui/NoDataState'
import ColumnSelector from '@/components/ui/ColumnSelector'
import { getRevenueTrend, getRevenueByLocation, getRevenueByCuisine, getTopEntities, getDatasetColumns, formatCurrency } from '@/lib/api'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend, Brush
} from 'recharts'
import { TrendingUp, MapPin, Sparkles, Award, Info } from 'lucide-react'

const COLORS = ['#6366f1','#818cf8','#a78bfa','#7c3aed','#4f46e5','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || '#818cf8', fontWeight: 600 }}>{formatCurrency(p.value)}</p>
        ))}
      </div>
    )
  }
  return null
}

export default function AnalyticsPage() {
  const session = useSessionStatus()
  const [trend, setTrend] = useState<any[]>([])
  const [byLocation, setByLocation] = useState<any[]>([])
  const [byCuisine, setByCuisine] = useState<any[]>([])
  const [topEntities, setTopEntities] = useState<any[]>([])
  const [filters, setFilters] = useState({ location: '', cuisine: '' })
  const [tab, setTab] = useState<'trend'|'location'|'cuisine'|'ranking'>('trend')
  const [loading, setLoading] = useState(true)

  // Per-tab column selectors
  const [numericCols, setNumericCols] = useState<string[]>([])
  const [trendCol, setTrendCol] = useState('revenue')
  const [locationCol, setLocationCol] = useState('revenue')
  const [cuisineCol, setCuisineCol] = useState('revenue')
  const [rankingCol, setRankingCol] = useState('revenue')

  const loadColumns = async () => {
    const cols = await getDatasetColumns()
    if (cols.numeric.length > 0) setNumericCols(cols.numeric)
  }

  const loadData = async () => {
    setLoading(true)
    const f = {
      ...(filters.location ? { location: filters.location } : {}),
      ...(filters.cuisine ? { cuisine: filters.cuisine } : {}),
    }
    try {
      const [trendData, locData, cuisineData, topData] = await Promise.all([
        getRevenueTrend(f, trendCol),
        getRevenueByLocation(f, locationCol),
        getRevenueByCuisine(f, cuisineCol),
        getTopEntities(20, f, rankingCol),
      ])
      setTrend(trendData)
      setByLocation(locData)
      setByCuisine(cuisineData)
      setTopEntities(topData)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadColumns() }, [session.hasData, session.active])
  useEffect(() => { loadData() }, [filters, session.hasData, session.active, trendCol, locationCol, cuisineCol, rankingCol])

  const hasData = trend.length > 0 || byLocation.length > 0 || byCuisine.length > 0 || topEntities.length > 0

  // Derived plain-English summary stats
  const topLoc = byLocation.length > 0 ? byLocation[0] : null
  const topCuis = byCuisine.length > 0 ? byCuisine[0] : null
  const totalRev = byLocation.reduce((acc, curr) => acc + (curr.revenue || 0), 0)
  const peakMonth = trend.length > 0 ? [...trend].sort((a,b) => b.revenue - a.revenue)[0] : null

  const tabs = [
    { id: 'trend', label: '📈 Revenue Trend' },
    { id: 'location', label: '📍 By Location' },
    { id: 'cuisine', label: '🍽️ By Cuisine / Category' },
    { id: 'ranking', label: '🏆 Ranking Leaderboard' },
  ]

  return (
    <div>
      <Header title="Revenue Analytics" subtitle="Deep-dive into revenue breakdown and performance trends" filters={filters} onFiltersChange={setFilters} onRefresh={loadData} />
      <div style={{ padding: 32 }}>

        {!loading && !hasData ? (
          <NoDataState
            title="No Data Available for Analytics"
            description="Upload your CSV or XML file using the button in the header or below to automatically generate analytics charts and insights."
          />
        ) : (
          <>
            {/* EASY TO UNDERSTAND SUMMARY BANNER */}
            <div className="glass-card animate-in" style={{
              padding: 24, marginBottom: 28, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(16,185,129,0.05) 100%)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Sparkles size={20} color="var(--accent-bright)" />
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Plain-English Executive Summary
                </h2>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 14
              }}>
                <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>TOP PERFORMING LOCATION</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                    {topLoc ? topLoc.location : 'N/A'}
                  </div>
                  {topLoc && (
                    <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 2 }}>
                      Generated {formatCurrency(topLoc.revenue)} ({totalRev > 0 ? Math.round((topLoc.revenue / totalRev)*100) : 0}% of total)
                    </div>
                  )}
                </div>

                <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>PRIMARY CATEGORY / CUISINE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                    {topCuis ? topCuis.cuisine : 'N/A'}
                  </div>
                  {topCuis && (
                    <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, marginTop: 2 }}>
                      Generated {formatCurrency(topCuis.revenue)}
                    </div>
                  )}
                </div>

                <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>PEAK REVENUE MONTH</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                    {peakMonth ? peakMonth.month : 'N/A'}
                  </div>
                  {peakMonth && (
                    <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>
                      Peak sales: {formatCurrency(peakMonth.revenue)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'var(--bg-card)', padding: 6, borderRadius: 12, border: '1px solid var(--border)', width: 'fit-content' }}>
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    background: tab === t.id ? 'var(--accent)' : 'transparent',
                    color: tab === t.id ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === 'trend' && (
              <div className="glass-card animate-in" style={{ padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Monthly Revenue Trend</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 20 }}>
                      <Info size={14} color="var(--accent-bright)" />
                      Shows revenue trajectory across all recorded months
                    </div>
                  </div>
                  <ColumnSelector columns={numericCols} value={trendCol} onChange={setTrendCol} label="Metric column" />
                </div>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                    <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => v?.slice(0,7)} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Brush
                      dataKey="month"
                      height={24}
                      stroke="rgba(99,102,241,0.4)"
                      fill="rgba(99,102,241,0.06)"
                      travellerWidth={6}
                      tickFormatter={v => v?.slice(0,7)}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {tab === 'location' && (
              <div className="glass-card animate-in" style={{ padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Revenue by Location</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 20 }}>
                      <Info size={14} color="var(--accent-bright)" />
                      Compares total revenue generated by each store / branch
                    </div>
                  </div>
                  <ColumnSelector columns={numericCols} value={locationCol} onChange={setLocationCol} label="Metric column" />
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={byLocation} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                    <YAxis type="category" dataKey="location" stroke="var(--text-muted)" fontSize={12} width={110} />
                    <Tooltip content={<CustomTooltip />} />
                    <Brush
                      dataKey="location"
                      height={22}
                      stroke="rgba(99,102,241,0.4)"
                      fill="rgba(99,102,241,0.06)"
                      travellerWidth={6}
                    />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {byLocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {tab === 'cuisine' && (
              <div className="glass-card animate-in" style={{ padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Revenue Distribution by Category / Cuisine</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 20 }}>
                      <Info size={14} color="var(--accent-bright)" />
                      Shows which product categories make up your total sales
                    </div>
                  </div>
                  <ColumnSelector columns={numericCols} value={cuisineCol} onChange={setCuisineCol} label="Metric column" />
                </div>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={byCuisine}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                    <XAxis dataKey="cuisine" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Brush
                      dataKey="cuisine"
                      height={22}
                      stroke="rgba(99,102,241,0.4)"
                      fill="rgba(99,102,241,0.06)"
                      travellerWidth={6}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {byCuisine.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {tab === 'ranking' && (
              <div className="glass-card animate-in" style={{ padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Top Performers Leaderboard</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ranked by selected metric</span>
                  </div>
                  <ColumnSelector columns={numericCols} value={rankingCol} onChange={setRankingCol} label="Rank by" />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Entity Name</th>
                        {topEntities[0]?.location !== undefined && <th>Location</th>}
                        {topEntities[0]?.cuisine !== undefined && <th>Category</th>}
                        {topEntities[0]?.rating !== undefined && <th>Rating</th>}
                        <th>{rankingCol !== 'revenue' ? rankingCol : 'Total Revenue'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topEntities.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)' }}>
                            #{i + 1}
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          {row.location !== undefined && <td>{row.location}</td>}
                          {row.cuisine !== undefined && <td>
                            <span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-bright)', padding: '2px 8px', borderRadius: 100, fontSize: 12, fontWeight: 500 }}>
                              {row.cuisine}
                            </span>
                          </td>}
                          {row.rating !== undefined && <td>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>⭐ {Number(row.rating).toFixed(1)}</span>
                          </td>}
                          <td style={{ fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
