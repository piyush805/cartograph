export async function register() {
  const { env } = await import("@/lib/env");
  env();
}
