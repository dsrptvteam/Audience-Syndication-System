'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Play, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Client {
  id: number
  name: string
  sftpHost: string
  sftpPort: number
  sftpUsername: string
  sftpDirectory: string
  filePattern: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ProcessResult {
  success: boolean
  fileName?: string
  recordsProcessed?: number
  newRecords?: number
  duplicates?: number
  updated?: number
  processingTime?: number
  error?: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [processingClientId, setProcessingClientId] = useState<number | null>(null)
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sftpHost: '',
    sftpPort: '22',
    sftpUsername: '',
    sftpPassword: '',
    sftpFolderPath: '/',
    filePattern: '*.csv',
    isActive: true,
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchClients = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/clients')
      if (!response.ok) {
        throw new Error('Failed to fetch clients')
      }
      const data = await response.json()
      setClients(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          sftpHost: formData.sftpHost,
          sftpPort: parseInt(formData.sftpPort, 10),
          sftpUsername: formData.sftpUsername,
          sftpPassword: formData.sftpPassword,
          sftpFolderPath: formData.sftpFolderPath,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create client')
      }

      // Reset form and close dialog
      setFormData({
        name: '',
        sftpHost: '',
        sftpPort: '22',
        sftpUsername: '',
        sftpPassword: '',
        sftpFolderPath: '/',
        filePattern: '*.csv',
        isActive: true,
      })
      setDialogOpen(false)

      // Refresh client list
      fetchClients()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleProcess = async (clientId: number) => {
    setProcessingClientId(clientId)
    setProcessResult(null)

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setProcessResult({
          success: false,
          error: data.error || 'Processing failed',
        })
      } else {
        setProcessResult({
          success: true,
          fileName: data.fileName,
          recordsProcessed: data.recordsProcessed,
          newRecords: data.newRecords,
          duplicates: data.duplicates,
          updated: data.updated,
          processingTime: data.processingTime,
        })
        // Refresh to show updated data
        fetchClients()
      }
    } catch (err) {
      setProcessResult({
        success: false,
        error: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setProcessingClientId(null)
    }
  }

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Error loading clients</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Process Result Toast */}
      {processResult && (
        <div
          className={`rounded-lg border p-4 ${
            processResult.success
              ? 'border-green-500 bg-green-50'
              : 'border-destructive bg-destructive/10'
          }`}
        >
          {processResult.success ? (
            <div>
              <p className="font-medium text-green-800">Processing Complete</p>
              <p className="text-sm text-green-700">
                File: {processResult.fileName} | {processResult.recordsProcessed} records |{' '}
                {processResult.newRecords} new | {processResult.updated} updated |{' '}
                {processResult.processingTime}ms
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-destructive">Processing Failed</p>
              <p className="text-sm text-destructive">{processResult.error}</p>
            </div>
          )}
          <button
            onClick={() => setProcessResult(null)}
            className="mt-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Configure SFTP connection details for the new client.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Client Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Acme Corporation"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 grid gap-2">
                    <Label htmlFor="sftpHost">SFTP Host *</Label>
                    <Input
                      id="sftpHost"
                      value={formData.sftpHost}
                      onChange={(e) =>
                        setFormData({ ...formData, sftpHost: e.target.value })
                      }
                      placeholder="sftp.example.com"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sftpPort">Port</Label>
                    <Input
                      id="sftpPort"
                      type="number"
                      value={formData.sftpPort}
                      onChange={(e) =>
                        setFormData({ ...formData, sftpPort: e.target.value })
                      }
                      placeholder="22"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sftpUsername">Username *</Label>
                    <Input
                      id="sftpUsername"
                      value={formData.sftpUsername}
                      onChange={(e) =>
                        setFormData({ ...formData, sftpUsername: e.target.value })
                      }
                      placeholder="username"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sftpPassword">Password *</Label>
                    <Input
                      id="sftpPassword"
                      type="password"
                      value={formData.sftpPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, sftpPassword: e.target.value })
                      }
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sftpFolderPath">SFTP Directory *</Label>
                  <Input
                    id="sftpFolderPath"
                    value={formData.sftpFolderPath}
                    onChange={(e) =>
                      setFormData({ ...formData, sftpFolderPath: e.target.value })
                    }
                    placeholder="/data/audience"
                    required
                  />
                </div>
                {formError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {formError}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Client
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SFTP Host</TableHead>
              <TableHead>Directory</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {searchQuery ? (
                    <div className="text-muted-foreground">
                      No clients found matching &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      No clients yet. Click &quot;Add Client&quot; to get started.
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    {client.sftpHost}:{client.sftpPort}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {client.sftpDirectory}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={client.isActive ? 'success' : 'secondary'}
                    >
                      {client.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(client.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProcess(client.id)}
                      disabled={processingClientId === client.id || !client.isActive}
                    >
                      {processingClientId === client.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      Process
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
