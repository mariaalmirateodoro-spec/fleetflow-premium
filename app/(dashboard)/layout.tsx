import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { MobileSidebarProvider } from '@/components/layout/MobileSidebarContext'
import { NotificationsProvider } from '@/components/layout/NotificationsContext'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()

  // Middleware handles unauthenticated users — if profile is still null here
  // (e.g. user exists in auth but profile row is missing), sign them out so the
  // middleware doesn't loop them back to /dashboard, then redirect to login.
  const supabase = createClient()

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login?error=profile_missing')
  }

  // Block deactivated users: sign them out and redirect with a clear message.
  if (!profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login?error=account_deactivated')
  }

  return (
    <ToastProvider>
      <NotificationsProvider profile={profile}>
        <MobileSidebarProvider>
          <div className="flex h-screen overflow-hidden bg-[#090e1a]">
            {/* Ambient background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-fleet-600/10 rounded-full blur-[120px]" />
              <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-600/8 rounded-full blur-[100px]" />
            </div>

            <Sidebar profile={profile} />

            <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
              {children}
            </main>
          </div>
        </MobileSidebarProvider>
      </NotificationsProvider>
    </ToastProvider>
  )
}
