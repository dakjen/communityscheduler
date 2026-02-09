'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

interface NavBarProps {
  title?: string;
  description?: string;
}

export function NavBar({ 
  title = "Community Resources", 
  description = "Connecting you with what you need" 
}: NavBarProps) {
  const pathname = usePathname();

  return (
    <header className="flex justify-between items-center pb-6 border-b border-secondary">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {title}
        </h1>
        <p className="text-gray-500">{description}</p>
      </div>
      <div className="flex gap-4 items-center">
        <Link href="/">
          <Button variant={pathname === '/' ? 'secondary' : 'ghost'}>Scheduling</Button>
        </Link>
        <Link href="/services">
          <Button variant={pathname === '/services' ? 'secondary' : 'ghost'}>Services</Button>
        </Link>
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="outline" disabled>Sign In</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
