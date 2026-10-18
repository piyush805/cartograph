import { auth } from "@clerk/nextjs/server";

export const instant = false;

export default async function WorkspacePage() {
  const { orgId, orgRole } = await auth.protect();

  if (!orgId) {
    return <p>No organization on this session.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-[12px]">{orgId}</p>
      {orgRole ? <p className="text-[12px] text-muted">{orgRole}</p> : null}
    </div>
  );
}
