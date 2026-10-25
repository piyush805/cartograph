import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { InviteForm } from "@/components/invite-form";
import { ThemeControl } from "@/components/theme-control";
import { createDatabase } from "@/lib/database";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

// The organization is read from the session on the server, so this shell waits
// for that read instead of sending a static shell without it.
export const instant = false;

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId, orgRole, has } = await auth.protect();
  await createDatabase();
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(stored) ? stored : "system";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-1">
        <span className="text-[13px] font-semibold tracking-tight">
          Cartograph
        </span>
        <span aria-hidden className="h-4 w-px bg-line" />
        <span className="font-mono text-[12px] text-muted">
          {orgId ?? "No organization on this session"}
        </span>
        {orgRole ? (
          <span className="border border-line px-1 font-mono text-[11px] text-muted">
            {orgRole}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {has({ role: "org:admin" }) ? (
            <>
              <InviteForm />
              <span aria-hidden className="h-4 w-px bg-line" />
            </>
          ) : null}
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/"
            afterCreateOrganizationUrl="/"
          />
          <ThemeControl current={theme} />
          <UserButton />
        </div>
      </header>
      <main className="flex-1 px-3 py-4">{children}</main>
    </div>
  );
}
