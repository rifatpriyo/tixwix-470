"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/client-api";
export function Logout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setPending(true);
          setError("");
          try {
            const result = await mutate("/api/auth/logout", {});
            if (result.redirect) window.location.assign(result.redirect);
            else setError(result.error ?? "Could not sign out.");
          } catch {
            setError("Could not sign out. Try again.");
          } finally {
            lock.current = false;
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
