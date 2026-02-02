"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { History, ChevronLeft, ChevronRight, FileText, CheckCircle, XCircle, Clock } from "lucide-react"

interface ProcessingLog {
  id: string
  fileName: string
  status: "pending" | "processing" | "completed" | "failed"
  totalRecords: number | null
  newRecords: number | null
  updatedRecords: number | null
  duplicateRecords: number | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
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

export default function HistoryPage() {
  const [logs, setLogs] = useState<ProcessingLog[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [selectedClient, setSelectedClient] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<ProcessingLog | null>(null)

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

  const fetchHistory = async (page: number, clientId: string, status: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })
      if (clientId && clientId !== "all") params.set("clientId", clientId)
      if (status && status !== "all") params.set("status", status)

      const response = await fetch(`/api/process/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
      }
    } catch (error) {
      console.error("Failed to fetch history:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
    fetchHistory(1, "all", "all")
  }, [])

  const handleClientChange = (value: string) => {
    setSelectedClient(value)
    fetchHistory(1, value, selectedStatus)
  }

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value)
    fetchHistory(1, selectedClient, value)
  }

  const handlePageChange = (newPage: number) => {
    fetchHistory(newPage, selectedClient, selectedStatus)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Clock className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return "—"
    const start = new Date(startedAt).getTime()
    const end = new Date(completedAt).getTime()
    const seconds = Math.floor((end - start) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Processing History</h1>
        <p className="text-muted-foreground">
          View file processing logs and status
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Processing Logs
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {pagination.total.toLocaleString()} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No processing logs found</h3>
              <p className="text-muted-foreground">
                {selectedClient !== "all" || selectedStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Process a client's SFTP files to see logs here"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {log.fileName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.client.name}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-right">
                        {log.totalRecords?.toLocaleString() ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {log.newRecords?.toLocaleString() ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {log.updatedRecords && log.updatedRecords > 0
                          ? log.updatedRecords.toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {log.duplicateRecords?.toLocaleString() ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getDuration(log.startedAt, log.completedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(log.startedAt)}
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
                    {pagination.total} logs
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

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processing Details</DialogTitle>
            <DialogDescription>
              {selectedLog?.fileName}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedLog.client.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="font-medium">{selectedLog.totalRecords?.toLocaleString() ?? "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New Records</p>
                  <p className="font-medium text-green-600">
                    {selectedLog.newRecords?.toLocaleString() ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duplicates</p>
                  <p className="font-medium">{selectedLog.duplicateRecords?.toLocaleString() ?? "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {getDuration(selectedLog.startedAt, selectedLog.completedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started At</p>
                  <p className="font-medium">{formatDate(selectedLog.startedAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed At</p>
                  <p className="font-medium">
                    {selectedLog.completedAt ? formatDate(selectedLog.completedAt) : "—"}
                  </p>
                </div>
              </div>
              {selectedLog.errorMessage && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-1">Error Message</p>
                  <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm font-mono">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
