"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  AlertCircle,
  Users,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"

interface Client {
  id: string
  name: string
}

interface UploadResult {
  success: boolean
  message?: string
  error?: string
  total: number
  active: number
  noIdentifier: number
  duplicates: number
  updated: number
  processingTime: number
}

export default function ManualUploadPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients")
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
      }
    } catch (err) {
      console.error("Failed to fetch clients:", err)
    }
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
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB")
        return
      }
      setSelectedFile(file)
      setError(null)
    } else {
      setError("Please upload a CSV file")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB")
        return
      }
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedClient) return

    setUploading(true)
    setUploadResult(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("clientId", selectedClient)

      const response = await fetch("/api/audience/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadResult({
          success: true,
          total: data.total,
          active: data.active,
          noIdentifier: data.noIdentifier,
          duplicates: data.duplicates,
          updated: data.updated,
          processingTime: data.processingTime,
        })
      } else {
        setError(data.error || "Upload failed")
      }
    } catch {
      setError("Network error occurred")
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setUploadResult(null)
    setError(null)
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manual Upload</h1>
        <p className="text-muted-foreground">
          Upload a CSV file to add audience members directly
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Upload a CSV file with columns: email, phone, firstName, lastName
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
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

            {/* File Dropzone */}
            <div>
              <label className="text-sm font-medium mb-2 block">CSV File</label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : selectedFile
                    ? "border-green-500 bg-green-50"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2 text-green-600">
                    <FileText className="h-10 w-10" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag & drop your CSV file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Maximum file size: 10MB
                    </p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedClient || uploading}
              className="w-full"
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
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Upload Results
            </CardTitle>
            <CardDescription>
              Summary of the processed records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadResult ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Upload Successful</p>
                    <p className="text-sm text-muted-foreground">
                      Processed in {formatTime(uploadResult.processingTime)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{uploadResult.total}</p>
                    <p className="text-sm text-muted-foreground">Total Records</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {uploadResult.active - uploadResult.updated}
                    </p>
                    <p className="text-sm text-muted-foreground">New Active</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{uploadResult.updated}</p>
                    <p className="text-sm text-muted-foreground">Updated</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">
                      {uploadResult.noIdentifier}
                    </p>
                    <p className="text-sm text-muted-foreground">No Identifier</p>
                  </div>
                </div>

                {uploadResult.noIdentifier > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      {uploadResult.noIdentifier} records have no email or phone and won&apos;t sync to Meta
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Link href="/dashboard/audience">
                    <Button variant="outline" className="w-full">
                      <Users className="h-4 w-4 mr-2" />
                      View Audience
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                  <Button variant="ghost" onClick={resetForm} className="w-full">
                    Upload Another File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload a CSV file to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CSV Format Guide */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Format Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your CSV file should include the following columns (headers are case-insensitive):
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Column</th>
                    <th className="text-left py-2 pr-4 font-medium">Required</th>
                    <th className="text-left py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">email</td>
                    <td className="py-2 pr-4 text-yellow-600">Recommended</td>
                    <td className="py-2 text-muted-foreground">Email address for Meta sync</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">phone</td>
                    <td className="py-2 pr-4 text-yellow-600">Recommended</td>
                    <td className="py-2 text-muted-foreground">Phone number for Meta sync</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">firstName</td>
                    <td className="py-2 pr-4 text-muted-foreground">Optional</td>
                    <td className="py-2 text-muted-foreground">First name for deduplication</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs">lastName</td>
                    <td className="py-2 pr-4 text-muted-foreground">Optional</td>
                    <td className="py-2 text-muted-foreground">Last name for deduplication</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs font-medium mb-1">Example CSV:</p>
              <pre className="text-xs text-muted-foreground font-mono">
{`email,phone,firstName,lastName
john@example.com,5551234567,John,Doe
jane@example.com,,Jane,Smith
,5559876543,Bob,Wilson`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
