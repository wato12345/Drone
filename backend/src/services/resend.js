const RESEND_API_URL = 'https://api.resend.com/emails'

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM?.trim() || 'onboarding@resend.dev'
  return {
    apiKey,
    from,
    configured: Boolean(apiKey),
  }
}

export async function sendEmail({ to, subject, html }) {
  const { apiKey, from, configured } = getResendConfig()
  if (!configured) {
    const err = new Error('Email service is not configured (RESEND_API_KEY)')
    err.status = 503
    throw err
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.error?.message === 'string'
          ? data.error.message
          : `Email send failed (${response.status})`
    const err = new Error(message)
    err.status = response.status >= 400 && response.status < 500 ? 400 : 502
    throw err
  }

  return data
}

export async function sendPasswordResetCodeEmail({ to, code, username }) {
  const safeName = username || 'there'
  return sendEmail({
    to,
    subject: 'Your password reset code',
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="margin:0 0 12px">Password reset</h2>
        <p>Hi ${safeName},</p>
        <p>Use this verification code to reset your Drone Path Planner password:</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:20px 0">${code}</p>
        <p>This code expires in <strong>15 minutes</strong>.</p>
        <p style="color:#64748b;font-size:13px">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })
}
