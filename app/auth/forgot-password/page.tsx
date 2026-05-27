import { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";
import {
  DEFAULT_POST_AUTH_REDIRECT_PATH,
  sanitizeRedirectPath,
} from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Request a password reset email for your Civic Cycle account",
};

interface ForgotPasswordPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectPath(
    params.redirectTo,
    DEFAULT_POST_AUTH_REDIRECT_PATH
  );

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Reset your password
        </h1>
        <p className="text-muted-foreground">
          Enter your email and we&apos;ll send a secure reset link
        </p>
      </div>

      <ForgotPasswordForm redirectTo={redirectTo} />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Remembered your password?{" "}
        <Link
          href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="text-primary hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
