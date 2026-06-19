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

// ─── Helper: format vehicle type for display ──────────────────────────────────

function formatVehicleType(type: string): string {
  const map: Record<string, string> = {
    sedan: 'Sedan',
    suv: 'SUV',
    van: 'Van',
    minibus: 'Minibus',
    luxury: 'Luxury Sedan',
    pickup: 'Pickup Truck',
  }
  if (!type) return type
  const key = type.toLowerCase()
  return map[key] ?? (type.charAt(0).toUpperCase() + type.slice(1))
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
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })
  const dropoff = data.dropoffDatetime
    ? new Date(data.dropoffDatetime).toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
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
        <tr><td>Vehicle Type</td><td>${formatVehicleType(data.vehicleType)}</td></tr>
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
  supplierName?: string
  finalCost?: number
}

export async function sendBookingApprovedEmail(data: BookingStatusEmailData) {
  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  const statusUrl = siteUrl ? `${siteUrl}/book/status/${data.referenceNumber}` : ''

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
        <span class="status-badge badge-approved">✓ Booking Confirmed</span>
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
        <tr><td>Vehicle Type</td><td>${formatVehicleType(data.vehicleType)}</td></tr>
        ${data.supplierName ? `<tr><td>Transport Provider</td><td><strong>${data.supplierName}</strong></td></tr>` : ''}
        ${data.finalCost != null ? `<tr><td>Total Cost</td><td><strong style="color:#10b981">₱${data.finalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td></tr>` : ''}
      </table>

      ${data.comments ? `
      <p class="section-title">Note from the Team</p>
      <div class="note-box">${data.comments}</div>
      ` : ''}

      <div class="note-box">
        <strong style="color:#c7d2fe">Your vehicle will be ready for you.</strong><br/>
        Please be at the pickup location a few minutes before your scheduled time. If you need to make any changes, please contact our team immediately with your reference number.
      </div>

      ${statusUrl ? `<a href="${statusUrl}" class="cta-btn">View Booking Status →</a>` : ''}

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
    `🎉 Booking Confirmed — Ref: ${data.referenceNumber}`,
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

// ─── Email: Booking Cancelled (by staff) ─────────────────────────────────────

interface BookingCancelledEmailData {
  guestName: string
  guestEmail: string
  referenceNumber: string
  pickupLocation: string
  dropoffLocation: string
  pickupDatetime: string
  cancellationReason?: string | null
}

export async function sendBookingCancelledEmail(data: BookingCancelledEmailData) {
  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  const statusUrl = siteUrl ? `${siteUrl}/book/status/${data.referenceNumber}` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking Cancelled</title>
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
        <span class="status-badge badge-rejected">✗ Booking Cancelled</span>
      </div>

      <div class="ref-box">
        <p class="ref-label">Booking Reference</p>
        <p class="ref-number">${data.referenceNumber}</p>
      </div>

      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
        We regret to inform you that your transport booking from <strong style="color:#e2e8f0">${data.pickupLocation}</strong> to <strong style="color:#e2e8f0">${data.dropoffLocation}</strong> scheduled for <strong style="color:#e2e8f0">${pickup}</strong> has been cancelled.
      </p>

      ${data.cancellationReason ? `
      <p class="section-title">Reason</p>
      <div class="note-box">${data.cancellationReason}</div>
      ` : ''}

      <div class="note-box">
        <strong style="color:#c7d2fe">Need to rebook or have questions?</strong><br/>
        Please contact our team and quote your reference number. We apologise for any inconvenience this may cause.
      </div>

      ${statusUrl ? `<a href="${statusUrl}" class="cta-btn">View Booking Status →</a>` : ''}

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
    `Booking Cancelled — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─── Email: Driver Assigned ───────────────────────────────────────────────────

interface DriverAssignedEmailData {
  guestName: string
  guestEmail: string
  referenceNumber: string
  pickupLocation: string
  dropoffLocation: string
  pickupDatetime: string
  vehicleType: string
  driverName: string
  driverPhone: string
  vehiclePlate?: string | null
  vehicleModel?: string | null
}

export async function sendDriverAssignedEmail(data: DriverAssignedEmailData) {
  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  const statusUrl = siteUrl ? `${siteUrl}/book/status/${data.referenceNumber}` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Driver Assigned</title>
<style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="header-logo">🧑‍✈️</div>
      <h1>FleetFlow Premium</h1>
      <p>Guest Transport Management System</p>
    </div>
    <div class="body">
      <p class="greeting">Hi <strong style="color:#e2e8f0">${data.guestName}</strong>,</p>

      <div style="text-align:center;margin-bottom:28px;">
        <span class="status-badge badge-approved">✓ Driver Assigned</span>
      </div>

      <div class="ref-box">
        <p class="ref-label">Booking Reference</p>
        <p class="ref-number">${data.referenceNumber}</p>
      </div>

      <p class="section-title">Your Driver</p>
      <table class="detail-table">
        <tr><td>Driver Name</td><td><strong style="color:#e2e8f0">${data.driverName}</strong></td></tr>
        <tr><td>Contact Number</td><td><strong style="color:#10b981">${data.driverPhone}</strong></td></tr>
        ${data.vehicleModel ? `<tr><td>Vehicle</td><td>${data.vehicleModel}</td></tr>` : ''}
        ${data.vehiclePlate ? `<tr><td>Plate Number</td><td><strong style="color:#818cf8">${data.vehiclePlate}</strong></td></tr>` : ''}
        <tr><td>Vehicle Type</td><td>${formatVehicleType(data.vehicleType)}</td></tr>
      </table>

      <p class="section-title">Trip Details</p>
      <table class="detail-table">
        <tr><td>Pickup Location</td><td>${data.pickupLocation}</td></tr>
        <tr><td>Drop-off Location</td><td>${data.dropoffLocation}</td></tr>
        <tr><td>Pickup Date &amp; Time</td><td>${pickup}</td></tr>
      </table>

      <div class="note-box">
        <strong style="color:#c7d2fe">You're all set!</strong><br/>
        Your driver will meet you at the pickup location. You can reach your driver directly at <strong style="color:#10b981">${data.driverPhone}</strong> if needed. Please be ready a few minutes before your scheduled pickup time.
      </div>

      ${statusUrl ? `<a href="${statusUrl}" class="cta-btn">View Booking Status →</a>` : ''}

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
    `🧑‍✈️ Driver Assigned — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─── Email: Trip Reminder (day before) ───────────────────────────────────────

interface TripReminderEmailData {
  guestName: string
  guestEmail: string
  referenceNumber: string
  pickupLocation: string
  dropoffLocation: string
  pickupDatetime: string
  vehicleType: string
  driverName?: string | null
  driverPhone?: string | null
  vehiclePlate?: string | null
  vehicleModel?: string | null
}

export async function sendTripReminderEmail(data: TripReminderEmailData) {
  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })
  const timeOnly = new Date(data.pickupDatetime).toLocaleString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  const statusUrl = siteUrl ? `${siteUrl}/book/status/${data.referenceNumber}` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Trip is Tomorrow</title>
<style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="header-logo">🔔</div>
      <h1>FleetFlow Premium</h1>
      <p>Guest Transport Management System</p>
    </div>
    <div class="body">
      <p class="greeting">Hi <strong style="color:#e2e8f0">${data.guestName}</strong>, your trip is coming up soon!</p>

      <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.35);border-radius:10px;padding:18px 20px;text-align:center;margin-bottom:28px;">
        <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Pickup Time</p>
        <p style="color:#c7d2fe;font-size:28px;font-weight:700;margin:0 0 4px;">${timeOnly}</p>
        <p style="color:#64748b;font-size:13px;margin:0;">${pickup}</p>
      </div>

      <div class="ref-box">
        <p class="ref-label">Booking Reference</p>
        <p class="ref-number">${data.referenceNumber}</p>
      </div>

      <p class="section-title">Trip Details</p>
      <table class="detail-table">
        <tr><td>Pickup Location</td><td><strong style="color:#e2e8f0">${data.pickupLocation}</strong></td></tr>
        <tr><td>Drop-off Location</td><td>${data.dropoffLocation}</td></tr>
        <tr><td>Vehicle Type</td><td>${formatVehicleType(data.vehicleType)}</td></tr>
      </table>

      ${data.driverName ? `
      <p class="section-title">Your Driver</p>
      <table class="detail-table">
        <tr><td>Driver</td><td><strong style="color:#e2e8f0">${data.driverName}</strong></td></tr>
        ${data.driverPhone ? `<tr><td>Contact</td><td><strong style="color:#10b981">${data.driverPhone}</strong></td></tr>` : ''}
        ${data.vehicleModel ? `<tr><td>Vehicle</td><td>${data.vehicleModel}</td></tr>` : ''}
        ${data.vehiclePlate ? `<tr><td>Plate Number</td><td><strong style="color:#818cf8">${data.vehiclePlate}</strong></td></tr>` : ''}
      </table>
      ` : ''}

      <div class="note-box">
        <strong style="color:#c7d2fe">Friendly reminder:</strong><br/>
        Please be at <strong style="color:#e2e8f0">${data.pickupLocation}</strong> by <strong style="color:#c7d2fe">${timeOnly}</strong> tomorrow. If your plans have changed, please contact our team as soon as possible.
      </div>

      ${statusUrl ? `<a href="${statusUrl}" class="cta-btn">View Booking Details →</a>` : ''}

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
    `🔔 Trip Reminder — Tomorrow at ${timeOnly} — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─────────────────────────────────────────────────────────────
// Modification Request — admin notification
// ─────────────────────────────────────────────────────────────

interface ModificationRequestEmailData {
  adminEmail: string
  guestName: string
  referenceNumber: string
  requestedPickupDatetime: string | null
  requestedPickupLocation: string | null
  requestedDropoffLocation: string | null
  requestedNotes: string | null
  originalPickupDatetime: string
  originalPickupLocation: string
  originalDropoffLocation: string
}

export async function sendModificationRequestEmail(data: ModificationRequestEmailData) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
    })

  const origPickup = fmt(data.originalPickupDatetime)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>✏️ Modification Request</h1>
      <p>A guest has requested changes to their booking</p>
    </div>
    <div class="body">
      <div class="section">
        <p class="label">Reference Number</p>
        <p class="value">${data.referenceNumber}</p>
      </div>
      <div class="section">
        <p class="label">Guest Name</p>
        <p class="value">${data.guestName}</p>
      </div>

      <div class="divider"></div>
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Requested Changes</p>

      ${data.requestedPickupDatetime ? `
      <div class="section">
        <p class="label">New Pickup Date/Time</p>
        <p class="value">${fmt(data.requestedPickupDatetime)}</p>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0">Was: ${origPickup}</p>
      </div>` : ''}

      ${data.requestedPickupLocation ? `
      <div class="section">
        <p class="label">New Pickup Location</p>
        <p class="value">${data.requestedPickupLocation}</p>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0">Was: ${data.originalPickupLocation}</p>
      </div>` : ''}

      ${data.requestedDropoffLocation ? `
      <div class="section">
        <p class="label">New Dropoff Location</p>
        <p class="value">${data.requestedDropoffLocation}</p>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0">Was: ${data.originalDropoffLocation}</p>
      </div>` : ''}

      ${data.requestedNotes ? `
      <div class="section">
        <p class="label">Guest Notes</p>
        <p class="value">${data.requestedNotes}</p>
      </div>` : ''}

      <div class="divider"></div>

      <div style="text-align:center;margin:24px 0">
        <a href="${siteUrl}/bookings" class="btn">Review Request in Admin →</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FleetFlow Premium · Internal System</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</div>
</body></html>`

  return await sendEmail(
    data.adminEmail,
    `✏️ Modification Request — ${data.guestName} — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─────────────────────────────────────────────────────────────
// Modification Approved — guest notification
// ─────────────────────────────────────────────────────────────

interface ModificationApprovedEmailData {
  guestEmail: string
  guestName: string
  referenceNumber: string
  pickupDatetime: string
  pickupLocation: string
  dropoffLocation: string
  vehicleType: string
}

export async function sendModificationApprovedEmail(data: ModificationApprovedEmailData) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>✅ Modification Approved</h1>
      <p>Your booking changes have been approved</p>
    </div>
    <div class="body">
      <p style="color:#94a3b8;margin:0 0 20px">Dear <strong style="color:#e2e8f0">${data.guestName}</strong>, your modification request has been <span class="badge badge-approved">Approved</span></p>

      <div class="section">
        <p class="label">Reference Number</p>
        <p class="value">${data.referenceNumber}</p>
      </div>

      <div class="divider"></div>
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Updated Trip Details</p>

      <div class="section">
        <p class="label">Pickup Date/Time</p>
        <p class="value">${pickup}</p>
      </div>
      <div class="section">
        <p class="label">Pickup Location</p>
        <p class="value">${data.pickupLocation}</p>
      </div>
      <div class="section">
        <p class="label">Dropoff Location</p>
        <p class="value">${data.dropoffLocation}</p>
      </div>
      <div class="section">
        <p class="label">Vehicle</p>
        <p class="value">${formatVehicleType(data.vehicleType)}</p>
      </div>

      <div class="divider"></div>

      <div style="text-align:center;margin:24px 0">
        <a href="${siteUrl}/book/status/${data.referenceNumber}" class="btn">View Booking Status →</a>
      </div>
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
    `✅ Modification Approved — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─────────────────────────────────────────────────────────────
// Modification Rejected — guest notification
// ─────────────────────────────────────────────────────────────

interface ModificationRejectedEmailData {
  guestEmail: string
  guestName: string
  referenceNumber: string
  pickupDatetime: string
  pickupLocation: string
  dropoffLocation: string
}

export async function sendModificationRejectedEmail(data: ModificationRejectedEmailData) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>❌ Modification Not Approved</h1>
      <p>Your modification request could not be accommodated</p>
    </div>
    <div class="body">
      <p style="color:#94a3b8;margin:0 0 20px">Dear <strong style="color:#e2e8f0">${data.guestName}</strong>, unfortunately your modification request has been <span class="badge badge-rejected">Rejected</span></p>

      <div class="section">
        <p class="label">Reference Number</p>
        <p class="value">${data.referenceNumber}</p>
      </div>

      <div class="divider"></div>
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Your Original Booking Remains</p>

      <div class="section">
        <p class="label">Pickup Date/Time</p>
        <p class="value">${pickup}</p>
      </div>
      <div class="section">
        <p class="label">Pickup Location</p>
        <p class="value">${data.pickupLocation}</p>
      </div>
      <div class="section">
        <p class="label">Dropoff Location</p>
        <p class="value">${data.dropoffLocation}</p>
      </div>

      <div class="divider"></div>

      <p style="color:#94a3b8;font-size:14px;text-align:center;margin:0 0 20px">If you have questions, please contact us directly.</p>

      <div style="text-align:center;margin:24px 0">
        <a href="${siteUrl}/book/status/${data.referenceNumber}" class="btn">View Booking Status →</a>
      </div>
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
    `❌ Modification Request Declined — Ref: ${data.referenceNumber}`,
    html,
  )
}

// ─────────────────────────────────────────────────────────────
// Trip Completion Receipt — guest notification
// ─────────────────────────────────────────────────────────────

interface TripCompletionReceiptEmailData {
  guestEmail: string
  guestName: string
  referenceNumber: string
  pickupDatetime: string
  dropoffDatetime: string | null
  pickupLocation: string
  dropoffLocation: string
  vehicleType: string
  vehiclePlate: string | null
  vehicleModel: string | null
  finalCostUsd: number | null
  driverName: string | null
}

export async function sendTripCompletionReceiptEmail(data: TripCompletionReceiptEmailData) {
  const pickup = new Date(data.pickupDatetime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const dropoff = data.dropoffDatetime
    ? new Date(data.dropoffDatetime).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
      })
    : null

  const completedDate = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseStyles}</style></head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>🧾 Trip Receipt</h1>
      <p>Thank you for choosing FleetFlow Premium</p>
    </div>
    <div class="body">
      <p style="color:#94a3b8;margin:0 0 20px">Dear <strong style="color:#e2e8f0">${data.guestName}</strong>, your trip has been completed. Here is your receipt.</p>

      <div class="section">
        <p class="label">Reference Number</p>
        <p class="value">${data.referenceNumber}</p>
      </div>
      <div class="section">
        <p class="label">Trip Completed</p>
        <p class="value">${completedDate}</p>
      </div>

      <div class="divider"></div>
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Trip Details</p>

      <div class="section">
        <p class="label">Pickup</p>
        <p class="value">${pickup}</p>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0">${data.pickupLocation}</p>
      </div>

      ${dropoff ? `
      <div class="section">
        <p class="label">Dropoff</p>
        <p class="value">${dropoff}</p>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0">${data.dropoffLocation}</p>
      </div>` : `
      <div class="section">
        <p class="label">Dropoff Location</p>
        <p class="value">${data.dropoffLocation}</p>
      </div>`}

      <div class="section">
        <p class="label">Vehicle</p>
        <p class="value">${formatVehicleType(data.vehicleType)}${data.vehicleModel ? ` — ${data.vehicleModel}` : ''}</p>
        ${data.vehiclePlate ? `<p style="color:#64748b;font-size:12px;margin:4px 0 0">Plate: ${data.vehiclePlate}</p>` : ''}
      </div>

      ${data.driverName ? `
      <div class="section">
        <p class="label">Driver</p>
        <p class="value">${data.driverName}</p>
      </div>` : ''}

      ${data.finalCostUsd != null ? `
      <div class="divider"></div>
      <div class="section" style="background:rgba(99,102,241,0.1);border-radius:8px;padding:16px;margin:0">
        <p class="label">Total Amount</p>
        <p style="font-size:28px;font-weight:700;color:#818cf8;margin:4px 0 0">$${data.finalCostUsd.toFixed(2)} <span style="font-size:14px;color:#64748b">USD</span></p>
      </div>` : ''}

      <div class="divider"></div>

      <p style="color:#94a3b8;font-size:14px;text-align:center;margin:0">We hope you had an excellent experience. Thank you for traveling with FleetFlow Premium.</p>
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
    `🧾 Trip Receipt — Ref: ${data.referenceNumber}`,
    html,
  )
}
