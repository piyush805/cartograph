import { clerkMiddleware } from "@clerk/nextjs/server";
import { env } from "@/lib/env";

function isPublic(pathname: string) {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/")
  );
}

export default clerkMiddleware(async (auth, request) => {
  env();

  if (isPublic(request.nextUrl.pathname)) return;

  // Signed-out requests leave before the page is rendered. Each page still
  // calls auth.protect(); this only keeps the HTML off the wire.
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) return redirectToSignIn();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
