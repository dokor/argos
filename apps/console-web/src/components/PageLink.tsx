"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/** Nonce-protected pages render per request; avoid speculative renders and canceled RSC fetches. */
export default function PageLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={props.prefetch ?? false} />;
}
