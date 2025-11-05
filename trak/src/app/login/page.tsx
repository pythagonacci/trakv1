import React from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth/actions";

interface PageProps {
  searchParams: Promise<{ redirectedFrom?: string; error?: string; message?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo = params?.redirectedFrom || "/dashboard";
  
  return (
    <AuthShell title="Sign in" subtitle="Welcome back.">
      <form action={login} className="space-y-5">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            <Mail className="w-4 h-4 absolute right-3 top-2.5 text-neutral-400" />
          </div>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" name="password" type="password" placeholder="••••••••" required />
            <Lock className="w-4 h-4 absolute right-3 top-2.5 text-neutral-400" />
          </div>
        </div>
        <Button type="submit" className="w-full">
          <LogIn className="w-4 h-4" /> Sign in
        </Button>
        <p className="text-xs text-neutral-600 text-center">
          Don't have an account? <a href="/signup" className="font-medium hover:underline">Create one</a>
        </p>
      </form>
    </AuthShell>
  );
}