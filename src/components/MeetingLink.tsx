"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";

export function MeetingLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      href={href}
      className={className}
      prefetch={intent ? true : null}
      onMouseEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
