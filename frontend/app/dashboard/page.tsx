'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Star, Users, MapPin, TrendingUp, BarChart2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import KPICard from '@/components/ui/KPICard'
import UploadSection from '@/components/ui/UploadSection'
import NoDataState from '@/components/ui/NoDataState'
import {
  getKPIs, getRevenueTrend, getRevenueByLocation, getRevenueByCuisine, getTopEntities,
  formatCurrency
} from '@/lib/api'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#7c3aed', '#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 13,
      }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || 'var(--accent-bright)', fontWeight: 600 }}>
            {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

import { useSessionStatus } from '@/lib/useSessionStatus'

export default function DashboardPage() {
  const session = useSessionStatus()
  const [kpis, setKpis] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [byLocation, setByLocation] = useState<any[]>([])
  const [byCuisine, setByCuisine] = useState<any[]>([])
  const [topEntities, setTopEntities] = useState<any[]>([])
  const [filters, setFilters] = useState({ location: '', cuisine: '' })
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const f = {
      ...(filters.location ? { location: filters.location } : {}),
      ...(filters.cuisine ? { cuisine: filters.cuisine } : {}),
    }
    try {
      const [kpisData, trendData, locData, cuisineData, topData] = await Promise.all([
        getKPIs(f),
        getRevenueTrend(f),
        getRevenueByLocation(f),
        getRevenueByCuisine(f),
        getTopEntities(10, f),
      ])
      setKpis(kpisData)
      setTrend(trendData)
      setByLocation(locData)
      setByCuisine(cuisineData)
      setTopEntities(topData)
    } catch (e) {
      console.error('Failed to load data:', e)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [filters, session.hasData, session.active])

  const hasData = kpis && kpis.total_records > 0

  return (
    <div>
      <Header
        title="Revenue Overview"
        subtitle="AI-powered revenue intelligence dashboard"
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={loadData}
      />

      <div style={{ padding: 32 }}>
        {/* Upload & Session Control */}
        <UploadSection onSessionChange={loadData} />

        {!loading && !hasData && (
          <NoDataState
            title="No Active Dataset Session"
            description="There is no data loaded. Please drop or select a CSV or XML file above and click 'Start Analysis' to unlock dashboard KPIs, charts, and analysis."
            showUploadButton={false}
          />
        )}

        {/* KPI Cards */}
        {hasData && kpis && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 28,
          }}>
            <KPICard
              title="Total Revenue"
              value={formatCurrency(kpis.total_revenue)}
              change={kpis.mom_growth}
              changeLabel="MoM growth"
              icon={DollarSign}
              accent="#6366f1"
              delay={0}
            />
            <KPICard
              title="Avg Rating"
              value={`${kpis.avg_rating}/5.0`}
              icon={Star}
              accent="#f59e0b"
              delay={0.05}
            />
            <KPICard
              title="Avg Service"
              value={`${kpis.avg_service_quality}/10`}
              icon={Users}
              accent="#10b981"
              delay={0.1}
            />
            <KPICard
              title="Best Location"
              value={kpis.best_location}
              icon={MapPin}
              accent="#3b82f6"
              delay={0.15}
            />
            <KPICard
              title="Top Cuisine"
              value={kpis.best_cuisine}
              icon={BarChart2}
              accent="#a78bfa"
              delay={0.2}
            />
            <KPICard
              title="Avg Revenue/Unit"
              value={formatCurrency(kpis.avg_revenue)}
              icon={TrendingUp}
              accent="#06b6d4"
              delay={0.25}
            />
          </div>
        )}

        {/* Revenue Trend */}
        {hasData && trend.length > 0 && (
          <div className="glass-card animate-in animate-in-delay-3" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
              Revenue Trend
            </h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                  <XAxis
                    dataKey="month"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickFormatter={v => v?.slice(0, 7) || v}
                  />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ fill: '#6366f1', r: 4 }}
                    activeDot={{ r: 6, fill: '#818cf8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Location + Cuisine Charts */}
        {hasData && (byLocation.length > 0 || byCuisine.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {byLocation.length > 0 && (
              <div className="glass-card animate-in animate-in-delay-4" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
                  Revenue by Location
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={byLocation} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                    <YAxis type="category" dataKey="location" stroke="var(--text-muted)" fontSize={11} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {byLocation.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {byCuisine.length > 0 && (
              <div className="glass-card animate-in animate-in-delay-5" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
                  Revenue by Cuisine
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={byCuisine.slice(0, 8)}
                      dataKey="revenue"
                      nameKey="cuisine"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {byCuisine.slice(0, 8).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend formatter={(v: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Top Entities Table */}
        {hasData && topEntities.length > 0 && (
          <div className="glass-card animate-in" style={{ padding: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
              Top Performers by Revenue
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    {topEntities[0]?.location !== undefined && <th>Location</th>}
                    {topEntities[0]?.cuisine !== undefined && <th>Cuisine</th>}
                    {topEntities[0]?.rating !== undefined && <th>Rating</th>}
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topEntities.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      {row.location !== undefined && <td>{row.location}</td>}
                      {row.cuisine !== undefined && <td>
                        <span style={{
                          background: 'rgba(99,102,241,0.15)',
                          color: 'var(--accent-bright)',
                          padding: '2px 8px',
                          borderRadius: 100,
                          fontSize: 12,
                          fontWeight: 500,
                        }}>{row.cuisine}</span>
                      </td>}
                      {row.rating !== undefined && <td>
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>⭐ {Number(row.rating).toFixed(1)}</span>
                      </td>}
                      <td style={{ fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
