import Link from "next/link";
import { isAdmin } from "@/lib/auth/session";
import { BasketIcon } from "./icons";
import { NavLinks, LogoutButton } from "./nav-client";

export async function TopNav() {
  const admin = await isAdmin();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 px-4 py-2 sm:min-h-14 sm:flex-nowrap sm:gap-6 sm:px-6 sm:py-0">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <BasketIcon size={17} />
          </span>
          <span className="font-mono text-[15px]">PriceTrack</span>
        </Link>
        {admin && (
          <div className="ml-auto sm:order-last">
            <LogoutButton />
          </div>
        )}
        {/* On mobile the links drop to a full-width scrollable second row. */}
        <div className="-mx-1 w-full overflow-x-auto pb-1 pt-1.5 sm:mx-0 sm:w-auto sm:overflow-visible sm:p-0">
          <NavLinks showUpload={admin} />
        </div>
      </div>
    </header>
  );
}
