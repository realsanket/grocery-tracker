"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/stores", label: "Stores" },
];

export function NavLinks({ showUpload }: { showUpload: boolean }) {
  const pathname = usePathname();
  const links = showUpload
    ? [...LINKS, { href: "/upload", label: "Upload Receipt" }]
    : LINKS;

  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              active
                ? "bg-stone-100 font-medium text-stone-900"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
    >
      Log out
    </button>
  );
}
