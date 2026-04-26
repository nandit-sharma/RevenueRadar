'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { getForecast, formatCurrency } from '@/lib/api'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

export default function ForecastingPage() {
  const [data, setData] = useState<any>(null)
  const [periods, setPeriods] = useState(6)
  const [loading, setLoading] = useState(true)

  const loadForecast = async () => {
    setLoading(true)
    try {
      const res = await getForecast(periods)
      setData(res)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadForecast() }, [periods])

  // Merge actual + forecast for combined chart
  const chartData = data ? [
    ...data.actual.map((d: any) => ({
      month: d.month?.slice(0, 7),
      actual: d.revenue,
    })),
    ...data.forecast.map((d: any) => ({
      month: d.month?.slice(0, 7),
      forecast: d.revenue,
      upper: d.upper,
      lower: d.lower,
    })),
  ] : []

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
          {payload.map((p: any, i: number) => p.value && (
            <p key={i} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
              {p.name}: {formatCurrency(p.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const splitMonth = data?.actual?.[data.actual.length - 1]?.month?.slice(0, 7)

  return (
    <div>
      <Header title="Revenue Forecasting" subtitle="ML-powered revenue projections with confidence intervals" />
      <div style={{ padding: 32 }}>

        {/* Controls */}
        <div className="glass-card animate-in" style={{ padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Forecast periods (months):</label>
            {[3, 6, 9, 12].map(p => (
              <button
                key={p}
                onClick={() => setPeriods(p)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                  background: periods === p ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: periods === p ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${periods === p ? 'transparent' : 'var(--border)'}`,
                }}
              >
                {p}M
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        {data?.summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Forecast Revenue', value: formatCurrency(data.summary.total_forecast_revenue), color: '#6366f1' },
              { label: 'Avg Monthly Forecast', value: formatCurrency(data.summary.avg_monthly_forecast), color: '#10b981' },
              { label: 'Projected Growth', value: `${data.summary.projected_growth_pct > 0 ? '+' : ''}${data.summary.projected_growth_pct}%`, color: data.summary.projected_growth_pct > 0 ? '#10b981' : '#ef4444' },
              { label: 'Forecast Horizon', value: `${data.summary.periods} Months`, color: '#f59e0b' },
            ].map((item, i) => (
              <div key={i} className="glass-card animate-in" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{item.label}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main forecast chart */}
        <div className="glass-card animate-in animate-in-delay-2" style={{ padding: 28, marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Revenue Forecast with Confidence Intervals
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Shaded area represents ±10% confidence interval around the forecast
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Computing forecast...</div>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
                {splitMonth && (
                  <ReferenceLine x={splitMonth} stroke="rgba(99,102,241,0.5)" strokeDasharray="6 3" label={{ value: 'Forecast start', fill: 'var(--text-muted)', fontSize: 11 }} />
                )}
                <Area dataKey="upper" fill="rgba(99,102,241,0.1)" stroke="none" name="Upper bound" />
                <Area dataKey="lower" fill="var(--bg-primary)" stroke="none" name="Lower bound" />
                <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Actual" connectNulls />
                <Line type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4 }} name="Forecast" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Forecast table */}
        {data?.forecast && (
          <div className="glass-card animate-in animate-in-delay-4" style={{ padding: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Forecast Breakdown</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Forecast Revenue</th>
                  <th>Lower Bound (−10%)</th>
                  <th>Upper Bound (+10%)</th>
                </tr>
              </thead>
              <tbody>
                {data.forecast.map((row: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{row.month?.slice(0, 7)}</td>
                    <td style={{ fontWeight: 700, color: '#6366f1', fontFamily: 'var(--font-mono)' }}>{formatCurrency(row.revenue)}</td>
                    <td style={{ color: '#ef4444', fontFamily: 'var(--font-mono)' }}>{formatCurrency(row.lower)}</td>
                    <td style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>{formatCurrency(row.upper)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
