"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { bdt } from "@/lib/events";
import type { Reservation } from "@/lib/reservations";
export function PendingCheckout({ id }: { id: string }) {
  const [booking, setBooking] = useState<Reservation | null>(null),
    [remaining, setRemaining] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    async (release = false) => {
      try {
        const response = await fetch(
          `/api/reservations/${id}${release ? "/release" : ""}`,
          {
            method: release ? "POST" : "GET",
            headers: release
              ? { "Content-Type": "application/json" }
              : undefined,
            body: release ? "{}" : undefined,
            cache: "no-store",
          },
        );
        const result = await response.json();
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) setBooking(null);
          throw new Error(result.error);
        }
        setBooking(result.reservation);
        if (result.reservation.state !== "pending") {
          try {
            sessionStorage.removeItem(
              "checkout:" + result.reservation.event_id,
            );
          } catch {
            /* Storage can be disabled by browser privacy settings. */
          }
        }
        setMessage("");
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Could not load reservation.",
        );
      }
    },
    [id],
  );
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 3000);
    const refresh = () => void load();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (!booking) return;
    const start = performance.now();
    const duration =
      Date.parse(booking.expires_at) - Date.parse(booking.server_now);
    const tick = () =>
      setRemaining(
        Math.max(0, Math.ceil((duration - (performance.now() - start)) / 1000)),
      );
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [booking]);
  return (
    <section className="panel mt-6">
      <h1 className="page-title">Your reservation</h1>
      {booking && (
        <>
          <p className="my-4 capitalize">Status: {booking.state}</p>
          <ul className="space-y-3">
            {booking.items.map((i) => (
              <li key={i.id}>
                {i.label} · {i.category_name} · {i.quantity} ×{" "}
                {bdt(i.unit_price_minor)} ={" "}
                {bdt(i.quantity * i.unit_price_minor)}
              </li>
            ))}
          </ul>
          <p className="my-5 text-xl font-bold">
            Total: {bdt(booking.total_minor)}
          </p>
          {booking.state === "pending" ? (
            <>
              <p role="timer" aria-label="Reservation time remaining">
                {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")} remaining
              </p>
              <p className="my-4">
                This reservation is pending. Payment and ticket confirmation
                will be available in the next division.
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await load(true);
                  setBusy(false);
                }}
              >
                Release reservation
              </Button>
            </>
          ) : (
            <p>
              The reservation has ended and its inventory is available to other
              customers.
            </p>
          )}
        </>
      )}
      <p role="status" className="mt-4">
        {message}
      </p>
    </section>
  );
}
