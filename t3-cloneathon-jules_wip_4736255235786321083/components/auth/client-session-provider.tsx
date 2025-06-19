"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

interface ClientSessionProviderProps {
  children: ReactNode;
}

export default function ClientSessionProvider({ children }: ClientSessionProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
