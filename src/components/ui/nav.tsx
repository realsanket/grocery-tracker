import Link from "next/link";
import { isAdmin } from "@/lib/auth/session";
import { BasketIcon } from "./icons";
import { NavLinks, LogoutButton } from "./nav-client";

export async function TopNav() {
  const admin = await isAdmin();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <BasketIcon size={17} />
          </span>
          <span className="font-mono text-[15px]">PriceTrack</span>
        </Link>
        <NavLinks showUpload={admin} />
        {admin && (
          <div className="ml-auto">
            <LogoutButton />
          </div>
        )}
      </div>
    </header>
  );
}
