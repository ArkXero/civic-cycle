import { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a Civic Cycle account",
};

interface SignupPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectPath(params.redirectTo);

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Create Account
        </h1>
        <p className="text-muted-foreground">
          Sign up to set keyword alerts and stay informed
        </p>
      </div>

      <SignupForm redirectTo={redirectTo} />

      <p className="text-center text-xs text-muted-foreground mt-5 leading-6">
        By creating an account, you acknowledge the{' '}
        <Link href="/privacy" className="text-primary hover:underline font-medium">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link
          href={`/auth/login${redirectTo !== "/" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
          className="text-primary hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
