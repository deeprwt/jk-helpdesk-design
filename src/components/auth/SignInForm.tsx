"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { apiLogin } from "@/lib/api"

export default function SignInForm() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [remember, setRemember] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [forgotOpen, setForgotOpen] = React.useState(false)
  const [forgotEmail, setForgotEmail] = React.useState("")
  const [forgotLoading, setForgotLoading] = React.useState(false)
  const [needsVerification, setNeedsVerification] = React.useState(false)
  const [resending, setResending] = React.useState(false)

  async function handleForgotPassword() {
    if (!forgotEmail) { toast.error("Please enter your email"); return }
    setForgotLoading(true)

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    })

    setForgotLoading(false)

    if (!res.ok) { toast.error("Failed to send reset link"); return }
    toast.success("If that email exists, a reset link has been sent.")
    setForgotOpen(false)
    setForgotEmail("")
  }

  async function handleResendVerification() {
    setResending(true)
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.already_verified) {
        setNeedsVerification(false)
        setError(null)
        toast.success("Your email is already verified. Please sign in.")
        return
      }
      toast.success("Verification email sent! Please check your inbox.")
    } catch {
      toast.error("Failed to resend verification email")
    } finally {
      setResending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNeedsVerification(false)

    try {
      await apiLogin(email, password)
      toast.success("Login Successfully")
      setTimeout(() => { window.location.href = "/" }, 800)
    } catch (err: unknown) {
      setLoading(false)
      const msg = err instanceof Error ? err.message : "Login failed"
      if (msg === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true)
      } else {
        setError(msg)
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to dashboard
        </Link>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">Sign In</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter your email and password to sign in!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>Email *</Label>
            <Input type="email" placeholder="info@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <Label>Password *</Label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <span onClick={() => setShowPassword((v) => !v)} className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2">
                {showPassword ? <Eye /> : <EyeOff />}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
              <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">Keep me logged in</span>
            </div>
            <Button type="button" onClick={() => setForgotOpen(true)} variant="link">Forgot password?</Button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {needsVerification && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <span className="text-xl">📧</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Please verify your email before logging in.</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Check your inbox for a verification link.</p>
                  <Button type="button" size="sm" variant="outline" className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={handleResendVerification} disabled={resending}>
                    {resending ? "Sending..." : "Resend Verification Email"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Button className="w-full" size="sm" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-5">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-brand-500 hover:text-brand-600">Sign Up</Link>
          </p>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg dark:bg-gray-900">
            <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white">Reset Password</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Enter your email and we&apos;ll send you a reset link.</p>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="info@gmail.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setForgotOpen(false)} disabled={forgotLoading}>Cancel</Button>
                <Button onClick={handleForgotPassword} disabled={forgotLoading}>{forgotLoading ? "Sending..." : "Send Link"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
