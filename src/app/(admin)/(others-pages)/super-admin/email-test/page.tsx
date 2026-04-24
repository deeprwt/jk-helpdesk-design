"use client"

import * as React from "react"
import { authHeaders } from "@/lib/api"
import RoleGate from "@/components/auth/RoleGate"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Mail, CheckCircle2, XCircle, Loader2, Server } from "lucide-react"
import { toast } from "sonner"

type TestResult = {
  ok: boolean
  stage: "config" | "verify" | "send" | "done"
  messageId?: string
  response?: string
  accepted?: string[]
  rejected?: string[]
  code?: string
  command?: string
  errorMessage?: string
  config: {
    host?: string
    port?: string
    secure?: string
    user?: string
    from?: string
  }
}

const STAGE_LABELS: Record<TestResult["stage"], string> = {
  config: "SMTP config missing",
  verify: "SMTP verify (handshake / auth)",
  send: "Send email",
  done: "Sent",
}

export default function EmailTestPage() {
  const [to, setTo] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [result, setResult] = React.useState<TestResult | null>(null)

  // Prefill "to" from logged-in user (best-effort)
  React.useEffect(() => {
    fetch("/api/auth/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.email) setTo(data.user.email)
      })
      .catch(() => {})
  }, [])

  const sendTest = async () => {
    if (!to.trim()) {
      toast.error("Recipient email is required")
      return
    }

    setSending(true)
    setResult(null)

    try {
      const res = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
        }),
      })

      const data: TestResult | { error: string } = await res
        .json()
        .catch(() => ({ error: "Invalid response" }))

      if ("error" in data && !("stage" in data)) {
        toast.error(data.error)
        return
      }

      const r = data as TestResult
      setResult(r)
      if (r.ok) toast.success("Email sent successfully")
      else toast.error(`SMTP failed at "${STAGE_LABELS[r.stage]}"`)
    } finally {
      setSending(false)
    }
  }

  return (
    <RoleGate allowedRoles={["superadmin"]}>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Email Test</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send a test email through the configured SMTP server to verify it works.
          </p>
        </div>

        {/* Form */}
        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">Recipient email *</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="someone@example.com"
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Leave blank for default"
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              Message <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave blank for default message"
              disabled={sending}
            />
          </div>

          <div className="pt-1">
            <Button onClick={sendTest} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Result */}
        {result && (
          <Card
            className={`p-5 border-2 ${
              result.ok
                ? "border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900/40"
                : "border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/40"
            }`}
          >
            <div className="flex items-start gap-3">
              {result.ok ? (
                <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h3 className="font-semibold text-base">
                    {result.ok ? "Email sent successfully" : "Email failed"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Stage: <Badge variant="secondary">{STAGE_LABELS[result.stage]}</Badge>
                  </p>
                </div>

                {result.ok ? (
                  <dl className="text-sm space-y-1.5 font-mono">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-28 shrink-0">messageId:</dt>
                      <dd className="break-all">{result.messageId}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-28 shrink-0">response:</dt>
                      <dd className="break-all">{result.response}</dd>
                    </div>
                    {result.accepted && result.accepted.length > 0 && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 shrink-0">accepted:</dt>
                        <dd>{result.accepted.join(", ")}</dd>
                      </div>
                    )}
                    {result.rejected && result.rejected.length > 0 && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 shrink-0">rejected:</dt>
                        <dd className="text-red-600">{result.rejected.join(", ")}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <dl className="text-sm space-y-1.5 font-mono">
                    {result.code && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 shrink-0">code:</dt>
                        <dd className="text-red-700 font-semibold">{result.code}</dd>
                      </div>
                    )}
                    {result.command && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 shrink-0">command:</dt>
                        <dd>{result.command}</dd>
                      </div>
                    )}
                    {result.errorMessage && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 shrink-0">message:</dt>
                        <dd className="break-all text-red-700">{result.errorMessage}</dd>
                      </div>
                    )}
                    {result.response && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 shrink-0">response:</dt>
                        <dd className="break-all">{result.response}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* SMTP Config panel */}
        {result?.config && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">SMTP configuration in use</h3>
            </div>
            <dl className="text-sm space-y-1.5 font-mono">
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">host:</dt>
                <dd>{result.config.host || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">port:</dt>
                <dd>{result.config.port || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">secure:</dt>
                <dd>{result.config.secure || "false"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">user:</dt>
                <dd>{result.config.user || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">from:</dt>
                <dd>{result.config.from || "—"}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground mt-3">
              Values come from the server's <code>.env</code> at the time the dev server
              started. Changes to <code>.env</code> require a dev-server restart.
            </p>
          </Card>
        )}
      </div>
    </RoleGate>
  )
}
