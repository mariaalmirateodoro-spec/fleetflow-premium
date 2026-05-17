import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const FROM_EMAIL = process.env.GMAIL_USER
  ? `FleetFlow Premium <${process.env.GMAIL_USER}>`
  : 'FleetFlow Premium <noreply@fleetflow.app>'

async function sendEmail(to: string, subject: string, html: string) {
  const info = await transporter.sendMail({ from: FROM_EMAIL, to, subject, html })
  console.log('[email] sent, messageId:', info.messageId)
  return info
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const baseStyles = `
  body { margin: 0; padding: 0; background-color: #0f1221; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: #161b2e; border: 1px solid rgba(99,102,241,0.2); border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 40px; text-align: center; }
  .header-logo { font-size: 28px; margin-bottom: 4px; }
  .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .header p { color: rgba(255,255,255,0.75); margin: 4px 0 0; font-size: 13px; }
  .body { padding: 32px 40px; }
  .greeting { color: #e2e8f0; font-size: 16px; margin: 0 0 24px; }
  .ref-box { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; padding: 16px 20px; text-align: center; margin-bottom: 28px; }
  .ref-label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; }
  .ref-number { color: #818cf8; font-size: 26px; font-weight: 700; letter-spacing: 2px; margin: 0; }
  .section-title { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  .detail-table td { padding: 8px 0; vertical-align: top; }
  .detail-table td:first-child { color: #64748b; font-size: 13px; width: 45%; }
  .detail-table td:last-child { color: #e2e8f0; font-size: 13px; font-weight: 500; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .badge-approved { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
  .badge-rejected { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
  .badge-pending { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
  .note-box { background: rgba(255,255,255,0.04); border-left: 3px solid #4f46e5; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-bottom: 28px; color: #94a3b8; font-size: 13px; line-height: 1.6; }
  .cta-btn { display: block; text-align: center; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 0 auto 28px; max-width: 240px; }
  .footer { padding: 24px 40px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; }
  .footer p { color: #475569; font-size: 12px; margin: 0 0 4px; }
  .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 24px 0; }
  @media (max-width: 480px) {
    .body, .header, .footer { padding-left: 24px; padding-right: 24px; }
  }
`

// ─── Email: Booking Submitted ─────────────────────────────────────────────────

interface BookingConfirmationData {
  guestName: string
  guestEmail: string
  referenceNumber: string
  pickupLocation: string
  dropoffLocation: string
  pickupDatetime: string
  dropoffDatetime?: string | null
  vehicleType: string
  guestCount: number
  specialRequests?: string | null
}

export async function sendBookingConfirmationEmail(data: BookingConfirmationData) {
  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const dropoff = data.dropoffDatetime
    ? new Date(data.dropoffDatetime).toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Not specified'

  // Build the public status page URL for this booking
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  const statusUrl = siteUrl
    ? `${siteUrl}/book/status/${data.referenceNumber}`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking Received</title>
<style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="header-logo">🚗</div>
      <h1>FleetFlow Premium</h1>
      <p>Guest Transport Management System</p>
    </div>
    <div class="body">
      <p class="greeting">Hi <strong style="color:#e2e8f0">${data.guestName}</strong>, your transport request has been received!</p>

      <div class="ref-box">
        <p class="ref-label">Your Booking Reference</p>
        <p class="ref-number">${data.referenceNumber}</p>
      </div>

      <p class="section-title">Trip Details</p>
      <table class="detail-table">
        <tr><td>Pickup Location</td><td>${data.pickupLocation}</td></tr>
        <tr><td>Drop-off Location</td><td>${data.dropoffLocation}</td></tr>
        <tr><td>Pickup Date &amp; Time</td><td>${pickup}</td></tr>
        <tr><td>Drop-off Date &amp; Time</td><td>${dropoff}</td></tr>
        <tr><td>Vehicle Type</td><td>${data.vehicleType}</td></tr>
        <tr><td>Number of Guests</td><td>${data.guestCount}</td></tr>
        ${data.specialRequests ? `<tr><td>Special Requests</td><td>${data.specialRequests}</td></tr>` : ''}
      </table>

      <div class="note-box">
        <strong style="color:#c7d2fe">What happens next?</strong><br/>
        Our team will review your request and confirm your booking shortly. You'll receive another email once a decision has been made. Please keep your reference number handy.
      </div>

      ${statusUrl ? `
      <a href="${statusUrl}" class="cta-btn">Track Booking Status →</a>
      ` : ''}

      <p style="color:#64748b;font-size:13px;text-align:center;margin:0">
        Questions? Contact our team and quote reference <strong style="color:#818cf8">${data.referenceNumber}</strong>.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FleetFlow Premium · Internal System</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</div>
</body></html>`

  return await sendEmail(
    data.guestEmail,
    `✅ Booking Received — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─── Email: Booking Approved ──────────────────────────────────────────────────

interface BookingStatusEmailData {
  guestName: string
  guestEmail: string
  referenceNumber: string
  pickupLocation: string
  dropoffLocation: string
  pickupDatetime: string
  vehicleType: string
  comments?: string | null
}

export async function sendBookingApprovedEmail(data: BookingStatusEmailData) {
  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking Approved</title>
<style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="header-logo">✅</div>
      <h1>FleetFlow Premium</h1>
      <p>Guest Transport Management System</p>
    </div>
    <div class="body">
      <p class="greeting">Great news, <strong style="color:#e2e8f0">${data.guestName}</strong>!</p>

      <div style="text-align:center;margin-bottom:28px;">
        <span class="status-badge badge-approved">✓ Booking Approved</span>
      </div>

      <div class="ref-box">
        <p class="ref-label">Booking Reference</p>
        <p class="ref-number">${data.referenceNumber}</p>
      </div>

      <p class="section-title">Your Trip</p>
      <table class="detail-table">
        <tr><td>Pickup Location</td><td>${data.pickupLocation}</td></tr>
        <tr><td>Drop-off Location</td><td>${data.dropoffLocation}</td></tr>
        <tr><td>Pickup Date &amp; Time</td><td>${pickup}</td></tr>
        <tr><td>Vehicle Type</td><td>${data.vehicleType}</td></tr>
      </table>

      ${data.comments ? `
      <p class="section-title">Note from the Team</p>
      <div class="note-box">${data.comments}</div>
      ` : ''}

      <div class="note-box">
        <strong style="color:#c7d2fe">Your driver will be ready for you.</strong><br/>
        Please be at the pickup location a few minutes before your scheduled time. If you need to make any changes, please contact our team immediately with your reference number.
      </div>

      <p style="color:#64748b;font-size:13px;text-align:center;margin:0">
        Reference: <strong style="color:#818cf8">${data.referenceNumber}</strong>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FleetFlow Premium · Internal System</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</div>
</body></html>`

  return await sendEmail(
    data.guestEmail,
    `🎉 Booking Approved — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─── Email: Booking Rejected ──────────────────────────────────────────────────

export async function sendBookingRejectedEmail(data: BookingStatusEmailData) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking Update</title>
<style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="header-logo">🚗</div>
      <h1>FleetFlow Premium</h1>
      <p>Guest Transport Management System</p>
    </div>
    <div class="body">
      <p class="greeting">Hi <strong style="color:#e2e8f0">${data.guestName}</strong>,</p>

      <div style="text-align:center;margin-bottom:28px;">
        <span class="status-badge badge-rejected">✗ Booking Not Confirmed</span>
      </div>

      <div class="ref-box">
        <p class="ref-label">Booking Reference</p>
        <p class="ref-number">${data.referenceNumber}</p>
      </div>

      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Unfortunately, we were unable to confirm your transport booking for <strong style="color:#e2e8f0">${data.pickupLocation} → ${data.dropoffLocation}</strong>.
      </p>

      ${data.comments ? `
      <p class="section-title">Reason</p>
      <div class="note-box">${data.comments}</div>
      ` : ''}

      <div class="note-box">
        <strong style="color:#c7d2fe">Need transport?</strong><br/>
        Please contact our team directly and we'll do our best to find an alternative arrangement for you. Quote your reference number when reaching out.
      </div>

      <p style="color:#64748b;font-size:13px;text-align:center;margin:0">
        Reference: <strong style="color:#818cf8">${data.referenceNumber}</strong>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FleetFlow Premium · Internal System</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</div>
</body></html>`

  return await sendEmail(
    data.guestEmail,
    `Booking Update — Ref: ${data.referenceNumber}`,
    html,
  )
}
