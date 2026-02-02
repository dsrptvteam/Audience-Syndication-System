"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Loader2,
  Download,
  CheckCircle,
  XCircle,
  Users,
} from "lucide-react"

interface AudienceMember {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  sourceFile: string | null
  dateAdded: string
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

interface Stats {
  total: number
  byClient: Array<{ clientId: number; clientName: string; count: number }>
  oldestDate: string | null
}

export default function DataQualityPage() {
  const [members, setMembers] = useState<AudienceMember[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [selectedClient, setSelectedClient] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<AudienceMember | null>(null)
  const [editForm, setEditForm] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingMember, setDeletingMember] = useState<AudienceMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

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

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const response = await fetch("/api/audience/no-identifier/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchMembers = useCallback(
    async (page: number, clientId: string, search: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "20",
        })
        if (clientId && clientId !== "all") params.set("clientId", clientId)
        if (search) params.set("search", search)

        const response = await fetch(`/api/audience/no-identifier?${params}`)
        if (response.ok) {
          const data = await response.json()
          setMembers(data.data || [])
          setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        }
      } catch (error) {
        console.error("Failed to fetch members:", error)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchClients()
    fetchStats()
    fetchMembers(1, "all", "")
  }, [fetchMembers])

  const handleClientChange = (value: string) => {
    setSelectedClient(value)
    setSelectedIds(new Set())
    fetchMembers(1, value, searchQuery)
  }

  const handleSearch = () => {
    setSelectedIds(new Set())
    fetchMembers(1, selectedClient, searchQuery)
  }

  const handlePageChange = (newPage: number) => {
    setSelectedIds(new Set())
    fetchMembers(newPage, selectedClient, searchQuery)
  }

  const openEditModal = (member: AudienceMember) => {
    setEditingMember(member)
    setEditForm({
      email: member.email || "",
      phone: member.phone || "",
      firstName: member.firstName || "",
      lastName: member.lastName || "",
    })
    setSaveError(null)
    setEditModalOpen(true)
  }

  const handleSave = async () => {
    if (!editingMember) return

    // Validate at least one identifier
    if (!editForm.email.trim() && !editForm.phone.trim()) {
      setSaveError("At least email or phone is required")
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/audience/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          firstName: editForm.firstName.trim() || null,
          lastName: editForm.lastName.trim() || null,
        }),
      })

      if (response.ok) {
        setEditModalOpen(false)
        // Refresh data
        fetchMembers(pagination.page, selectedClient, searchQuery)
        fetchStats()
      } else {
        const data = await response.json()
        setSaveError(data.error || "Failed to save changes")
      }
    } catch {
      setSaveError("Network error occurred")
    } finally {
      setSaving(false)
    }
  }

  const openDeleteDialog = (member: AudienceMember) => {
    setDeletingMember(member)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingMember) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/audience/${deletingMember.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setDeleteDialogOpen(false)
        setDeletingMember(null)
        // Refresh data
        fetchMembers(pagination.page, selectedClient, searchQuery)
        fetchStats()
      }
    } catch (error) {
      console.error("Failed to delete:", error)
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    setBulkDeleting(true)

    try {
      // Delete each selected member
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/audience/${id}`, { method: "DELETE" })
      )
      await Promise.all(deletePromises)

      setSelectedIds(new Set())
      fetchMembers(pagination.page, selectedClient, searchQuery)
      fetchStats()
    } catch (error) {
      console.error("Failed to bulk delete:", error)
    } finally {
      setBulkDeleting(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ limit: "10000" })
      if (selectedClient && selectedClient !== "all") {
        params.set("clientId", selectedClient)
      }
      if (searchQuery) params.set("search", searchQuery)

      const response = await fetch(`/api/audience/no-identifier?${params}`)
      if (!response.ok) return

      const data = await response.json()
      const records = data.data || []

      // Create CSV content
      const headers = ["First Name", "Last Name", "Email", "Phone", "Source File", "Client", "Date Added"]
      const rows = records.map((m: AudienceMember) => [
        m.firstName || "",
        m.lastName || "",
        m.email || "",
        m.phone || "",
        m.sourceFile || "",
        m.client.name,
        new Date(m.dateAdded).toLocaleDateString(),
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map((row: string[]) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n")

      // Download
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `no-identifier-records-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to export:", error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Quality</h1>
        <p className="text-muted-foreground">
          Review and manage records without email or phone identifiers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total No-Identifier Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{stats?.total || 0}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : stats?.byClient && stats.byClient.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stats.byClient.slice(0, 3).map((c) => (
                  <Badge key={c.clientId} variant="secondary">
                    {c.clientName}: {c.count}
                  </Badge>
                ))}
                {stats.byClient.length > 3 && (
                  <Badge variant="outline">+{stats.byClient.length - 3} more</Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">No data</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Oldest Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <span className="text-2xl font-bold">
                {stats?.oldestDate ? formatDate(stats.oldestDate) : "N/A"}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Records Without Identifiers
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {pagination.total.toLocaleString()} total
            </span>
          </CardTitle>
          <CardDescription>
            These records have no email or phone and cannot be synced to Meta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">No records without identifiers</h3>
              <p className="text-muted-foreground">
                {selectedClient !== "all" || searchQuery
                  ? "Try adjusting your filters"
                  : "All records have email or phone identifiers"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === members.length && members.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Source File</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(member.id)}
                          onChange={() => toggleSelect(member.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {member.firstName || member.lastName
                            ? `${member.firstName || ""} ${member.lastName || ""}`.trim()
                            : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.email || member.phone || "No contact info"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.client.name}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {member.sourceFile || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(member.dateAdded)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(member)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} records
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

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
            <DialogDescription>
              Add an email or phone to make this record syncable to Meta
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-yellow-600">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-yellow-600">*</span>
              </Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="5551234567"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="text-yellow-600">*</span> At least one of email or phone is required
            </p>

            {saveError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4" />
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
              {deletingMember && (
                <span className="block mt-2 font-medium">
                  {deletingMember.firstName} {deletingMember.lastName}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
