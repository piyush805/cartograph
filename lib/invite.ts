"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { headers } from "next/headers";

export type InviteResult = { ok: true } | { ok: false; message: string };

export async function invite(email: string): Promise<InviteResult> {
  const { userId, orgId, has } = await auth.protect();

  if (!orgId) {
    return { ok: false, message: "No organization on this session." };
  }

  if (!has({ role: "org:admin" })) {
    return { ok: false, message: "Only an admin can invite someone." };
  }

  const address = email.trim();
  if (!address) {
    return { ok: false, message: "Enter an email address." };
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    return { ok: false, message: "Could not determine the address of this app." };
  }

  const proto = headerList.get("x-forwarded-proto") ?? "http";

  try {
    const clerk = await clerkClient();
    await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      inviterUserId: userId,
      emailAddress: address,
      role: "org:member",
      redirectUrl: `${proto}://${host}/sign-in`,
    });
  } catch (error) {
    return { ok: false, message: invitationError(error) };
  }

  return { ok: true };
}

function invitationError(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return (
      error.errors[0]?.longMessage ??
      error.errors[0]?.message ??
      "Invitation failed."
    );
  }

  if (error instanceof Error && error.message) return error.message;
  return "Invitation failed.";
}
