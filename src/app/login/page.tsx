'use client';

export const dynamic = 'force-dynamic';

import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { login, createAdminAction } from '@/app/actions';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation'; // Added useRouter import

function LoginFormContent() {
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get('registered') === 'true';
  const router = useRouter(); // Initialize useRouter

  const handleSubmit = async (formData: FormData) => {
    setError('');
    try {
      if (isLogin) {
        await login(formData);
      } else {
        await createAdminAction(formData);
      }
    } catch (e: any) {
        if (e.message === 'NEXT_REDIRECT') {
             throw e;
        }
        setError(e.message || 'Action failed');
        toast.error(e.message || 'Action failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? 'Admin Login' : 'Request Admin Access'}</CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Sign in to manage bookings and rooms' 
              : 'Submit a request for admin access'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRegistered && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md border border-green-200">
              Request sent! An admin will review your account.
            </div>
          )}
          <form action={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" name="fullName" type="text" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" type="text" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full">
              {isLogin ? 'Sign In' : 'Submit Request'}
            </Button>
            <Button 
              variant="outline" 
              className="w-full mt-2" 
              onClick={() => router.back()}
            >
              Back
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? "Need access? Request an account" : "Already have an account? Sign in"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
