// One-off SMTP smoke test.
// Run with:  node --env-file=.env scripts/test-email.mjs
// Sends a test message through the configured SMTP and prints the result.

import nodemailer from "nodemailer"

const TO = process.argv[2] || "deepak.rawat@cgbindia.com"

console.log("── SMTP test ────────────────────────────────")
console.log("SMTP_HOST  :", process.env.SMTP_HOST)
console.log("SMTP_PORT  :", process.env.SMTP_PORT)
console.log("SMTP_SECURE:", process.env.SMTP_SECURE)
console.log("SMTP_USER  :", process.env.SMTP_USER)
console.log("SMTP_FROM  :", process.env.SMTP_FROM)
console.log("TO         :", TO)
console.log("─────────────────────────────────────────────")

if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
  console.error("✗ SMTP env vars are missing. Did you pass --env-file=.env?")
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15_000,
  greetingTimeout:   10_000,
  socketTimeout:     20_000,
  family: 4, // force IPv4 lookup
})

console.log("→ Verifying SMTP connection (handshake + auth)…")
try {
  await transporter.verify()
  console.log("✓ SMTP connection OK — host reachable, credentials accepted")
} catch (err) {
  console.error("✗ SMTP verify failed:", err?.code || "", err?.message || err)
  process.exit(2)
}

console.log("→ Sending test email…")
try {
  const info = await transporter.sendMail({
    from: `"JK Food Helpdesk (SMTP test)" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: TO,
    subject: `SMTP test — ${new Date().toISOString()}`,
    text: `This is a smoke test from the JK Food Helpdesk app. If you're seeing this, SMTP is working.\n\nHost: ${process.env.SMTP_HOST}\nPort: ${process.env.SMTP_PORT}\nFrom: ${process.env.SMTP_FROM}\nSent: ${new Date().toISOString()}\n`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:24px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        <h2 style="margin:0 0 12px;color:#16a34a;">✓ SMTP is working</h2>
        <p style="color:#374151;">This is a test email from the JK Food Helpdesk application.</p>
        <table style="margin-top:16px;font-size:13px;color:#4b5563;border-collapse:collapse;">
          <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;">Host</td><td><code>${process.env.SMTP_HOST}</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;">Port</td><td><code>${process.env.SMTP_PORT}</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;">From</td><td><code>${process.env.SMTP_FROM}</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;">Sent</td><td><code>${new Date().toISOString()}</code></td></tr>
        </table>
      </div>
    `,
  })
  console.log("✓ Email sent")
  console.log("  messageId:", info.messageId)
  console.log("  response :", info.response)
  console.log("  accepted :", info.accepted)
  console.log("  rejected :", info.rejected)
} catch (err) {
  console.error("✗ sendMail failed:")
  console.error("  code   :", err?.code)
  console.error("  command:", err?.command)
  console.error("  message:", err?.message)
  if (err?.response) console.error("  resp   :", err.response)
  process.exit(3)
}
