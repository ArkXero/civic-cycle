import { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Civic Cycle account",
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string; error?: string; reason?: string }>;
}

function getAuthErrorMessage(error?: string, reason?: string) {
  if (!error) return null;

  if (error === "auth" && reason === "exchange") {
    return "Authentication failed while completing sign-in. If this happened from localhost, make sure the localhost callback URL is allowed in Supabase Auth.";
  }

  if (error === "auth" && reason === "provider") {
    return "Authentication was canceled or rejected by the provider.";
  }

  if (error === "auth") {
    return "Authentication failed. Please try again.";
  }

  return "An error occurred. Please try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectPath(params.redirectTo);
  const errorMessage = getAuthErrorMessage(params.error, params.reason);

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome Back
        </h1>
        <p className="text-muted-foreground">
          Sign in to manage your keyword alerts
        </p>
      </div>

      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 mb-6">
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      <LoginForm redirectTo={redirectTo} />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href={`/auth/signup${redirectTo !== "/" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
          className="text-primary hover:underline font-medium"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
