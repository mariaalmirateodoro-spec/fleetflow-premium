import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Temporary diagnostic endpoint — DELETE after confirming emails work
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      step: 'env-check',
      error: 'RESEND_API_KEY is not set in environment variables',
    })
  }

  const resend = new Resend(apiKey)

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'FleetFlow Premium <onboarding@resend.dev>',
    to: 'mariaalmira.teodoro@gmail.com', // send to your own email to bypass free-tier restriction
    subject: '🔧 FleetFlow Email Test',
    html: '<p>This is a test email from FleetFlow. If you see this, emails are working!</p>',
  })

  if (error) {
    return NextResponse.json({
      ok: false,
      step: 'resend-send',
      error,
      hint: 'Check the error.statusCode and error.message to understand why Resend rejected the send',
    })
  }

  return NextResponse.json({
    ok: true,
    message: 'Email sent successfully! Check mariaalmira.teodoro@gmail.com',
    resendId: data?.id,
  })
}
