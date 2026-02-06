import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { verifySession } from '@/lib/auth';

const isAdminRoute = createRouteMatcher(['/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // 1. Custom Admin Logic
  if (isAdminRoute(req)) {
     const cookie = req.cookies.get('session')?.value;
     const session = cookie ? await verifySession(cookie) : null;
     if (!session) {
         return NextResponse.redirect(new URL('/login', req.url));
     }
     return NextResponse.next();
  }
  
  // 2. Clerk Logic (Optional: protect customer routes if needed)
  // if (isCustomerRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};