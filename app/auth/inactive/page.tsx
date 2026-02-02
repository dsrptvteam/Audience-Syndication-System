"use client"

import { signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Ban, LogOut } from "lucide-react"

export default function InactivePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Ban className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Account Deactivated</CardTitle>
          <CardDescription>
            Your account has been deactivated by an administrator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            You no longer have access to this dashboard. If you believe this is an error,
            please contact your system administrator.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
