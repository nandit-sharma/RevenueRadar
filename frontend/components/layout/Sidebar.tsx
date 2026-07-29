'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BarChart3, Lightbulb, TrendingUp,
  GitCompareArrows, MessageSquare, Upload, Radar, ChevronRight
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/insights', label: 'Insights', icon: Lightbulb },
  { href: '/dashboard/forecasting', label: 'Forecasting', icon: TrendingUp },
  { href: '/dashboard/alerts', label: 'Compare', icon: GitCompareArrows },
  { href: '/dashboard/chat', label: 'AI Chat', icon: MessageSquare },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}>
            <Radar size={20} color="white" />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}>
              Revenue<span className="gradient-text">Radar</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2 }}>
              AI Intelligence Platform
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4 }}>
          Main Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link${isActive ? ' active' : ''}`} style={{ marginBottom: 2 }}>
              <Icon size={17} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && <ChevronRight size={14} style={{ opacity: 0.6 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Upload section */}
      <div style={{ padding: '12px 12px 20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.1))',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Upload size={14} color="var(--accent-bright)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Upload Data</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
            Import CSV to analyze your revenue data
          </p>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ width: '100%', padding: '8px 12px', fontSize: 12 }}>
              Import CSV
            </button>
          </Link>
        </div>
      </div>
    </aside>
  )
}
