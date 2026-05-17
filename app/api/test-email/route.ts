import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'GMAIL_USER or GMAIL_APP_PASSWORD not set' })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })

  try {
    const info = await transporter.sendMail({
      from: `FleetFlow Premium <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: '🔧 FleetFlow Email Test',
      html: '<p>This is a test email from FleetFlow. If you see this, Gmail SMTP is working!</p>',
    })
    return NextResponse.json({ ok: true, message: 'Email sent!', messageId: info.messageId })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
