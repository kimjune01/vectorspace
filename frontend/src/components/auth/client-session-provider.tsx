import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

interface ClientSessionProviderProps {
  children: ReactNode;
}

export default function ClientSessionProvider({ children }: ClientSessionProviderProps) {
  return <AuthProvider>{children}</AuthProvider>;
}
