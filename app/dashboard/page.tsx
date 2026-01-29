'use client'

import { useEffect, useState } from 'react'
import { Users, Building2, AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface ClientStats {
  clientId: number
  clientName: string
  count: number
}

interface StatsData {
  totalActive: number
  byClient: ClientStats[]
  expiringSoon: number
  addedToday: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/audience/stats')
        if (!response.ok) {
          throw new Error('Failed to fetch statistics')
        }
        const data = await response.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Error loading statistics</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Active Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Active Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.totalActive.toLocaleString() || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Across all clients
            </p>
          </CardContent>
        </Card>

        {/* Members Added Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Added Today
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.addedToday.toLocaleString() || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              New members today
            </p>
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expiring Soon
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.expiringSoon.toLocaleString() || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Less than 7 days remaining
            </p>
          </CardContent>
        </Card>

        {/* Active Clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Clients
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.byClient.length || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              With audience data
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Members by Client */}
      <Card>
        <CardHeader>
          <CardTitle>Members by Client</CardTitle>
          <CardDescription>
            Audience distribution across all active clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : stats?.byClient && stats.byClient.length > 0 ? (
            <div className="space-y-4">
              {stats.byClient.map((client) => {
                const percentage = stats.totalActive > 0
                  ? Math.round((client.count / stats.totalActive) * 100)
                  : 0
                return (
                  <div key={client.clientId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {client.clientName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {client.count.toLocaleString()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No client data available yet.
              <br />
              <span className="text-sm">
                Add clients and process files to see statistics.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/dashboard/clients"
              className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent"
            >
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Manage Clients</span>
            </a>
            <a
              href="/dashboard/audience"
              className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent"
            >
              <Users className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">View Audience</span>
            </a>
            <a
              href="/dashboard/history"
              className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent"
            >
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Processing History</span>
            </a>
            <a
              href="/dashboard/purchases"
              className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent"
            >
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Upload Purchases</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
