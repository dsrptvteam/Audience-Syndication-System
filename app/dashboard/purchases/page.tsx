"use client"

import { useState, useEffect, useCallback } from "react"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react"

interface PurchaseRemoval {
  id: string
  email: string | null
  phone: string | null
  matchedMemberId: string | null
  removedFromMeta: boolean
  processedAt: string
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

interface UploadResult {
  success: boolean
  message: string
  totalRecords?: number
  matchedRecords?: number
  removedFromMeta?: number
}

export default function PurchasesPage() {
  const [removals, setRemovals] = useState<PurchaseRemoval[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [selectedClient, setSelectedClient] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadClient, setUploadClient] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

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

  const fetchHistory = useCallback(async (page: number, clientId: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })
      if (clientId && clientId !== "all") params.set("clientId", clientId)

      const response = await fetch(`/api/purchases/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setRemovals(data.removals || [])
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
      }
    } catch (error) {
      console.error("Failed to fetch purchase history:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
    fetchHistory(1, "all")
  }, [fetchHistory])

  const handleClientChange = (value: string) => {
    setSelectedClient(value)
    fetchHistory(1, value)
  }

  const handlePageChange = (newPage: number) => {
    fetchHistory(newPage, selectedClient)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".csv")) {
      setSelectedFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !uploadClient) return

    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("clientId", uploadClient)

      const response = await fetch("/api/purchases/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadResult({
          success: true,
          message: "Purchase list processed successfully",
          totalRecords: data.totalRecords,
          matchedRecords: data.matchedRecords,
          removedFromMeta: data.removedFromMeta,
        })
        fetchHistory(1, selectedClient)
      } else {
        setUploadResult({
          success: false,
          message: data.error || "Upload failed",
        })
      }
    } catch (_error) {
      setUploadResult({
        success: false,
        message: "Network error occurred",
      })
    } finally {
      setUploading(false)
    }
  }

  const resetUploadDialog = () => {
    setUploadDialogOpen(false)
    setUploadClient("")
    setSelectedFile(null)
    setUploadResult(null)
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

  const formatPhone = (phone: string | null) => {
    if (!phone) return "—"
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
    }
    return phone
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Removals</h1>
          <p className="text-muted-foreground">
            Upload purchase lists to remove buyers from audiences
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload List
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Removal History
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
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : removals.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No purchase removals found</h3>
              <p className="text-muted-foreground">
                {selectedClient !== "all"
                  ? "Try selecting a different client"
                  : "Upload a purchase list to remove buyers from audiences"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Matched</TableHead>
                    <TableHead>Removed from Meta</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {removals.map((removal) => (
                    <TableRow key={removal.id}>
                      <TableCell>{removal.email || "—"}</TableCell>
                      <TableCell>{formatPhone(removal.phone)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{removal.client.name}</Badge>
                      </TableCell>
                      <TableCell>
                        {removal.matchedMemberId ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {removal.removedFromMeta ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(removal.processedAt)}
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
                    {pagination.total} removals
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

      <Dialog open={uploadDialogOpen} onOpenChange={resetUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Purchase List</DialogTitle>
            <DialogDescription>
              Upload a CSV file with purchaser emails/phones to remove from audience
            </DialogDescription>
          </DialogHeader>

          {uploadResult ? (
            <div className="py-4">
              {uploadResult.success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-green-600">
                    <CheckCircle className="h-8 w-8" />
                    <div>
                      <p className="font-semibold">{uploadResult.message}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{uploadResult.totalRecords}</p>
                      <p className="text-xs text-muted-foreground">Total Records</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{uploadResult.matchedRecords}</p>
                      <p className="text-xs text-muted-foreground">Matched</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{uploadResult.removedFromMeta}</p>
                      <p className="text-xs text-muted-foreground">Removed from Meta</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Upload Failed</p>
                    <p className="text-sm text-muted-foreground">{uploadResult.message}</p>
                  </div>
                </div>
              )}
              <DialogFooter className="mt-6">
                <Button onClick={resetUploadDialog}>Close</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Client</label>
                  <Select value={uploadClient} onValueChange={setUploadClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">CSV File</label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : selectedFile
                        ? "border-green-500 bg-green-50"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <FileText className="h-5 w-5" />
                        <span className="font-medium">{selectedFile.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                          className="ml-2"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Drag & drop your CSV file here, or
                        </p>
                        <label>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <Button variant="outline" size="sm" asChild>
                            <span>Browse Files</span>
                          </Button>
                        </label>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    CSV should have &quot;email&quot; and/or &quot;phone&quot; columns
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetUploadDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !uploadClient || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
