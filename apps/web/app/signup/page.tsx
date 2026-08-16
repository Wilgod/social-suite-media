"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        organizationName: form.get("organizationName"),
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.push("/login");
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create your workspace</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-1">
          <label htmlFor="organizationName" className="text-sm">Organization name</label>
          <input id="organizationName" name="organizationName" type="text" required className="w-full rounded border px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm">Email</label>
          <input id="email" name="email" type="email" required className="w-full rounded border px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm">Password</label>
          <input id="password" name="password" type="password" required minLength={8} className="w-full rounded border px-3 py-2" />
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded bg-black text-white py-2 disabled:opacity-50">
          {submitting ? "Creating..." : "Create workspace"}
        </button>
        <p className="text-sm text-neutral-500">
          Already have an account? <a href="/login" className="underline">Log in</a>
        </p>
      </form>
    </main>
  );
}
