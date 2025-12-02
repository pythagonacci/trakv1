import { ReactNode } from "react";
import { ThemeProvider } from "@/app/dashboard/theme-context";

export default function ClientPublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

