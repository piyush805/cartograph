const required = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
] as const;

export type Env = {
  clerkPublishableKey: string;
  clerkSecretKey: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  signInUrl: string;
  signUpUrl: string;
  signInFallbackRedirectUrl: string;
  signUpFallbackRedirectUrl: string;
};

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing environment: ${missing.join(", ")}`);
  }

  cached = {
    clerkPublishableKey: read("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    clerkSecretKey: read("CLERK_SECRET_KEY"),
    supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    signInUrl: read("NEXT_PUBLIC_CLERK_SIGN_IN_URL"),
    signUpUrl: read("NEXT_PUBLIC_CLERK_SIGN_UP_URL"),
    signInFallbackRedirectUrl: read(
      "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
    ),
    signUpFallbackRedirectUrl: read(
      "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
    ),
  };

  if (cached.signInFallbackRedirectUrl !== cached.signUpFallbackRedirectUrl) {
    throw new Error(
      "Sign-in and sign-up must fall back to the same URL. Set NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL and NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL to the same path.",
    );
  }

  return cached;
}

function read(name: (typeof required)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment: ${name}`);
  return value;
}
