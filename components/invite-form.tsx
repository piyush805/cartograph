"use client";

import { useState } from "react";
import { invite } from "@/lib/invite";

export function InviteForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const result = await invite(String(formData.get("email") ?? ""));
    setMessage(result.ok ? "Invitation sent." : result.message);
    setPending(false);
  }

  return (
    <form action={onSubmit} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="invite-email">
        Email address
      </label>
      <input
        id="invite-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="name@example.com"
        className="h-6 w-44 border border-line bg-canvas px-2 font-mono text-[12px] text-ink outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-6 border border-line px-2 text-[12px] text-ink hover:border-accent disabled:text-muted"
      >
        {pending ? "Sending" : "Invite"}
      </button>
      {message ? (
        <span className="text-[12px] text-muted" role="status">
          {message}
        </span>
      ) : null}
    </form>
  );
}
