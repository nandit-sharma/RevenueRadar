'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { getRevenueTrend, getRevenueByLocation, getRevenueByCuisine, getTopEntities, formatCurrency } from '@/lib/api'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'

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
  const [trend, setTrend] = useState<any[]>([])
  const [byLocation, setByLocation] = useState<any[]>([])
  const [byCuisine, setByCuisine] = useState<any[]>([])
  const [topEntities, setTopEntities] = useState<any[]>([])
  const [filters, setFilters] = useState({ location: '', cuisine: '' })
  const [tab, setTab] = useState<'trend'|'location'|'cuisine'|'ranking'>('trend')

  const loadData = async () => {
    const f = {
      ...(filters.location ? { location: filters.location } : {}),
      ...(filters.cuisine ? { cuisine: filters.cuisine } : {}),
    }
    const [trendData, locData, cuisineData, topData] = await Promise.all([
      getRevenueTrend(f),
      getRevenueByLocation(f),
      getRevenueByCuisine(f),
      getTopEntities(20, f),
    ])
    setTrend(trendData)
    setByLocation(locData)
    setByCuisine(cuisineData)
    setTopEntities(topData)
  }

  useEffect(() => { loadData() }, [filters])

  const tabs = [
    { id: 'trend', label: 'Revenue Trend' },
    { id: 'location', label: 'By Location' },
    { id: 'cuisine', label: 'By Cuisine' },
    { id: 'ranking', label: 'Ranking Table' },
  ]

  return (
    <div>
      <Header title="Revenue Analytics" subtitle="Deep-dive into revenue breakdown and trends" filters={filters} onFiltersChange={setFilters} onRefresh={loadData} />
      <div style={{ padding: 32 }}>
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>Monthly Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => v?.slice(0,7)} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'location' && (
          <div className="glass-card animate-in" style={{ padding: 28 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>Revenue by Location</h3>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={byLocation}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="location" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" radius={[6,6,0,0]}>
                  {byLocation.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'cuisine' && (
          <div className="glass-card animate-in" style={{ padding: 28 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>Revenue by Cuisine Type</h3>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={byCuisine} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                <YAxis type="category" dataKey="cuisine" stroke="var(--text-muted)" fontSize={11} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" radius={[0,6,6,0]}>
                  {byCuisine.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'ranking' && (
          <div className="glass-card animate-in" style={{ padding: 28 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>Restaurant Ranking Table</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Cuisine</th>
                    <th>Rating</th>
                    <th>Service</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topEntities.map((row: any, i: number) => (
                    <tr key={i}>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: '50%',
                          background: i < 3 ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.1)',
                          color: i < 3 ? '#f59e0b' : 'var(--text-muted)',
                          fontSize: 11, fontWeight: 700,
                        }}>{i + 1}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td>{row.location}</td>
                      <td><span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-bright)', padding: '2px 8px', borderRadius: 100, fontSize: 12 }}>{row.cuisine}</span></td>
                      <td style={{ color: '#f59e0b', fontWeight: 600 }}>⭐ {Number(row.rating || 0).toFixed(1)}</td>
                      <td>{Number(row.service_quality_score || 0).toFixed(1)}</td>
                      <td style={{ fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{formatCurrency(row.revenue)}</td>
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
