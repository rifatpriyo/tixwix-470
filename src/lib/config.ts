export function supabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return !!(
    url &&
    key &&
    !url.includes("your-project") &&
    !key.includes("your-publishable")
  );
}
export function supabaseConfig() {
  if (!supabaseConfigured())
    throw new Error("Supabase environment is not configured.");
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
export function appOrigin(requestUrl?: string) {
  const value =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : requestUrl);
  if (!value) throw new Error("APP_URL is required.");
  return new URL(value).origin;
}
