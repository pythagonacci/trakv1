import DashboardLayoutClient from "./layout-client";
import { WorkspaceProvider } from "./workspace-context";
import { ThemeProvider } from "./theme-context";
import { ReactQueryProvider } from "@/lib/react-query/providers";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * Optimized Dashboard Layout - No server-side data fetching
 * All data is loaded client-side with React Query for instant navigation
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ReactQueryProvider>
          <WorkspaceProvider>
            <DashboardLayoutClient>
              {children}
            </DashboardLayoutClient>
          </WorkspaceProvider>
        </ReactQueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}