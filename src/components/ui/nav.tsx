import Link from "next/link";
import { isAdmin } from "@/lib/auth/session";
import { NavLinks, LogoutButton } from "./nav-client";

export async function TopNav() {
  const admin = await isAdmin();
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-sm text-white">
            ₸
          </span>
          <span>PriceTrack</span>
        </Link>
        <NavLinks showUpload={admin} />
        <div className="ml-auto">
          {admin ? (
            <LogoutButton />
          ) : (
            <Link
              href="/login"
              className="text-sm text-stone-500 transition-colors hover:text-stone-900"
            >
              Admin login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
