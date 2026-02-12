import { ReactNode } from "react";
import { ThemeProvider } from "@/app/dashboard/theme-context";
import { ReactQueryProvider } from "@/lib/react-query/providers";
import ClientAccountHeader from "./client-account-header";

export default function ClientPublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ThemeProvider>
      <ReactQueryProvider>
        <div className="h-full overflow-y-auto bg-[var(--background)]">
          <ClientAccountHeader />
          {children}
        </div>
      </ReactQueryProvider>
    </ThemeProvider>
  );
}

