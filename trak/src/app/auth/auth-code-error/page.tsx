import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <AuthShell title="Authentication error" subtitle="Something went wrong during sign-in.">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-10 w-10 text-[var(--error)]" />
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          The authentication link may have expired or already been used.
          Please try signing in again.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/login">
            <Button className="w-full">Back to sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline" className="w-full">Create an account</Button>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
