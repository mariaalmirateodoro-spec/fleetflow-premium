import os, subprocess, sys

lock = r'D:\Car Rental - App\.git\index.lock'
if os.path.exists(lock):
    os.remove(lock)
    print("Lock removed")
else:
    print("No lock file found")

os.chdir(r'D:\Car Rental - App')
files = [
    "app/(dashboard)/approvals/page.tsx",
    "app/(dashboard)/bookings/page.tsx",
    "app/api/approvals/route.ts",
    "app/api/bookings/[id]/route.ts",
    "app/api/bookings/route.ts",
    "components/bookings/BookingsClient.tsx",
]
r = subprocess.run(["git", "add"] + files, capture_output=True, text=True)
print("git add stdout:", r.stdout)
print("git add stderr:", r.stderr)

r2 = subprocess.run(["git", "commit", "-m", "fix: remove email from profiles joins (column does not exist in profiles table)"], capture_output=True, text=True)
print("git commit stdout:", r2.stdout)
print("git commit stderr:", r2.stderr)

r3 = subprocess.run(["git", "push"], capture_output=True, text=True)
print("git push stdout:", r3.stdout)
print("git push stderr:", r3.stderr)
print("DONE")
