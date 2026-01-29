"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, ChevronLeft, ChevronRight, Users } from "lucide-react"

interface AudienceMember {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  retentionExpiry: string
  createdAt: string
  client: {
    id: string
    name: string
  }
}

interface Client {
  id: string
  name: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AudiencePage() {
  const [members, setMembers] = useState<AudienceMember[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [search, setSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients")
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error)
    }
  }

  const fetchAudience = useCallback(async (page: number, searchQuery: string, clientId: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })
      if (searchQuery) params.set("search", searchQuery)
      if (clientId && clientId !== "all") params.set("clientId", clientId)

      const response = await fetch(`/api/audience?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
      }
    } catch (error) {
      console.error("Failed to fetch audience:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
    fetchAudience(1, "", "all")
  }, [fetchAudience])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      fetchAudience(1, value, selectedClient)
    }, 300)
    setSearchTimeout(timeout)
  }

  const handleClientChange = (value: string) => {
    setSelectedClient(value)
    fetchAudience(1, search, value)
  }

  const handlePageChange = (newPage: number) => {
    fetchAudience(newPage, search, selectedClient)
  }

  const getDaysRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate)
    const now = new Date()
    const diffTime = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getDaysRemainingBadge = (expiryDate: string) => {
    const days = getDaysRemaining(expiryDate)
    if (days <= 0) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (days < 7) {
      return <Badge variant="destructive">{days} days</Badge>
    }
    if (days <= 14) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{days} days</Badge>
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">{days} days</Badge>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return "—"
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
    }
    return phone
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audience Members</h1>
        <p className="text-muted-foreground">
          View and search all audience members across clients
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Members
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {pagination.total.toLocaleString()} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedClient} onValueChange={handleClientChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No members found</h3>
              <p className="text-muted-foreground">
                {search || selectedClient !== "all"
                  ? "Try adjusting your search or filter"
                  : "Process a file to add audience members"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Days Remaining</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.firstName} {member.lastName}
                      </TableCell>
                      <TableCell>{member.email || "—"}</TableCell>
                      <TableCell>{formatPhone(member.phone)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.client.name}</Badge>
                      </TableCell>
                      <TableCell>{getDaysRemainingBadge(member.retentionExpiry)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(member.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} members
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
