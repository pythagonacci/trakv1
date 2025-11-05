import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Link href="/login">
        <Button size="lg" className="gap-2">
          <LogIn className="w-4 h-4" />
          Go to Login
        </Button>
      </Link>
    </div>
  );
}
