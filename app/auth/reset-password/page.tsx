import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_POST_AUTH_REDIRECT_PATH,
  sanitizeRedirectPath,
} from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Set New Password",
  description: "Set a new password for your Civic Cycle account",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectPath(
    params.redirectTo,
    DEFAULT_POST_AUTH_REDIRECT_PATH
  );
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Set a new password
        </h1>
        <p className="text-muted-foreground">
          Choose a new password for your Civic Cycle account
        </p>
      </div>

      {user ? (
        <ResetPasswordForm redirectTo={redirectTo} />
      ) : (
        <div className="space-y-6 text-center">
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4">
            <p className="text-sm">
              This reset link is expired or invalid. Request a new password
              reset email to continue.
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link
                href={`/auth/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}`}
              >
                Request a new reset link
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link
                href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
              >
                Return to sign in
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
