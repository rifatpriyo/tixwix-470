"use client";
import dynamic from "next/dynamic";
import { PreviewBoundary } from "@/components/preview-boundary";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { bdt, dhakaDate, type EventDetail } from "@/lib/events";
import {
  checkoutSchema,
  type Inventory,
  type Seat,
  type CheckoutInput,
} from "@/lib/reservations";
const Preview = dynamic(() => import("@/components/seat-preview"), {
  ssr: false,
  loading: () => <p>Loading 3D preview…</p>,
});
function readRetry(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function SeatBooking({ event }: { event: EventDetail }) {
  const [session, setSession] = useState(event.sessions[0]?.id ?? "");
  const [inventory, setInventory] = useState<Inventory | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [focused, setFocused] = useState<Seat | null>(null),
    [preview, setPreview] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(false);
  useEffect(() => {
    const restore = setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(`checkout:${event.id}`);
        if (saved) {
          const input = checkoutSchema.parse(JSON.parse(saved));
          if (event.sessions.some((s) => s.id === input.session_id)) {
            setSession(input.session_id);
            setSelected(input.seat_ids);
            setQuantities(
              Object.fromEntries(
                input.general_admission.map((i) => [i.category_id, i.quantity]),
              ),
            );
          }
        }
      } catch {
        /* Storage may be unavailable; API idempotency still applies. */
      }
    }, 0);
    return () => clearTimeout(restore);
  }, [event.id, event.sessions]);
  const request = useRef<CheckoutInput | null>(null);
  const router = useRouter();
  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch(`/api/sessions/${session}/availability`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setInventory(result);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not refresh availability.",
      );
      setInventory(null);
    }
  }, [session]);
  useEffect(() => {
    let active = true;
    const run = () => {
      if (active) void refresh();
    };
    run();
    const timer = setInterval(run, 3000);
    window.addEventListener("online", run);
    window.addEventListener("focus", run);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("focus", run);
    };
  }, [refresh]);
  function reset() {
    request.current = null;
    setMessage("");
  }
  async function checkout() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!request.current) {
        const input = {
          session_id: session,
          idempotency_key: crypto.randomUUID(),
          seat_ids: selected,
          general_admission: Object.entries(quantities)
            .filter(([, n]) => n > 0)
            .map(([category_id, quantity]) => ({ category_id, quantity })),
        };
        const key = `checkout:${event.id}`;
        const saved = readRetry(key);
        if (saved) {
          try {
            const previous = checkoutSchema.parse(JSON.parse(saved));
            if (
              JSON.stringify({ ...previous, idempotency_key: "" }) ===
              JSON.stringify({ ...input, idempotency_key: "" })
            )
              input.idempotency_key = previous.idempotency_key;
          } catch {
            /* Ignore invalid persisted requests. */
          }
        }
        request.current = input;
        try {
          sessionStorage.setItem(key, JSON.stringify(input));
        } catch {
          /* In-memory retries remain available. */
        }
      }
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.current),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) setLogin(true);
        if (response.status === 409) {
          request.current = null;
          try {
            sessionStorage.removeItem(`checkout:${event.id}`);
          } catch {
            /* Storage may be disabled. */
          }
        }
        throw new Error(result.error ?? "Could not reserve tickets.");
      }
      router.push(`/checkout/${result.reservation.id}`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Connection lost. Retry the same selection to recover your reservation.",
      );
      void refresh();
    } finally {
      setBusy(false);
    }
  }
  const current = inventory?.session_id === session ? inventory : null;
  const chosen = current?.seats.filter((s) => selected.includes(s.id)) ?? [];
  const total =
    chosen.reduce(
      (n, s) =>
        n +
        (current?.categories.find((c) => c.id === s.category_id)?.price_minor ??
          0),
      0,
    ) +
    (current?.categories.reduce(
      (n, c) => n + (quantities[c.id] ?? 0) * c.price_minor,
      0,
    ) ?? 0);
  return (
    <section className="panel mt-8" aria-labelledby="tickets-title">
      <h2 id="tickets-title" className="text-2xl font-bold">
        Choose your tickets
      </h2>
      <label className="my-4 block">
        Session (Asia/Dhaka)
        <select
          className="mt-2 block w-full rounded border p-3"
          value={session}
          disabled={busy}
          onChange={(e) => {
            setSession(e.target.value);
            setSelected([]);
            setQuantities({});
            setFocused(null);
            reset();
          }}
        >
          {event.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {dhakaDate(s.starts_at)}
            </option>
          ))}
        </select>
      </label>
      {current ? (
        <>
          <p className="text-sm">
            Availability refreshes every 3 seconds. Your tickets are reserved
            when checkout succeeds.
          </p>
          {!current.eligible && (
            <p role="status">
              This session is no longer accepting reservations.
            </p>
          )}
          {current.seats.length > 0 ? (
            <>
              <div className="my-5 rounded bg-secondary p-3 text-center font-semibold">
                STAGE
              </div>
              <div className="overflow-x-auto pb-3" aria-label="Seat map">
                {Array.from(new Set(current.seats.map((s) => s.row_label))).map(
                  (row) => (
                    <div key={row} className="mb-2 flex gap-2">
                      <span className="w-6 shrink-0 py-2">{row}</span>
                      {current.seats
                        .filter((s) => s.row_label === row)
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={selected.includes(s.id)}
                            aria-label={`${s.label}, ${s.available ? "available" : "unavailable"}`}
                            aria-disabled={!s.available || busy}
                            className={`h-11 min-w-11 rounded border text-sm ${!s.available ? "bg-gray-200 text-gray-500" : selected.includes(s.id) ? "bg-primary text-primary-foreground" : "bg-white"}`}
                            onFocus={() => setFocused(s)}
                            onClick={() => {
                              setFocused(s);
                              if (!s.available || busy) return;
                              reset();
                              setSelected((prev) =>
                                prev.includes(s.id)
                                  ? prev.filter((id) => id !== s.id)
                                  : [...prev, s.id],
                              );
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                    </div>
                  ),
                )}
              </div>
              <p className="text-sm">
                Tab between seats; press Enter or Space to select. Unavailable
                seats can still be previewed.
              </p>
              {focused && (
                <p className="my-3">
                  {focused.section} {focused.label} ·{" "}
                  {
                    current.categories.find((c) => c.id === focused.category_id)
                      ?.name
                  }{" "}
                  ·{" "}
                  {bdt(
                    current.categories.find((c) => c.id === focused.category_id)
                      ?.price_minor ?? null,
                  )}{" "}
                  ·{" "}
                  {current.seats.find((s) => s.id === focused.id)?.available
                    ? "Available"
                    : "Unavailable"}
                </p>
              )}
              {current.preview === "concert-hall-v1" ? (
                <>
                  <Button
                    variant="outline"
                    disabled={!focused}
                    onClick={() => setPreview((v) => !v)}
                  >
                    {preview ? "Hide 3D preview" : "Explore 3D seat view"}
                  </Button>
                  {preview && focused && (
                    <PreviewBoundary>
                      <Preview seat={focused} seats={current.seats} />
                    </PreviewBoundary>
                  )}
                </>
              ) : (
                <p>
                  No 3D preview is mapped for this venue. Seat selection remains
                  available.
                </p>
              )}
            </>
          ) : (
            <p className="my-4">
              General admission · no numbered seating or mapped 3D preview.
            </p>
          )}
          {current.categories
            .filter((c) => c.kind === "general_admission")
            .map((c) => (
              <label key={c.id} className="my-4 block">
                {c.name} · {bdt(c.price_minor)} · {c.remaining} remaining
                <input
                  aria-label={`${c.name} quantity`}
                  type="number"
                  min={0}
                  max={Math.min(20, c.remaining ?? 0)}
                  value={quantities[c.id] ?? 0}
                  disabled={busy}
                  className="ml-3 w-20 rounded border p-2"
                  onChange={(e) => {
                    reset();
                    setQuantities((q) => ({
                      ...q,
                      [c.id]: Number(e.target.value),
                    }));
                  }}
                />
              </label>
            ))}
          <p className="my-4">
            Selected:{" "}
            {chosen.map((s) => s.label).join(", ") || "No numbered seats"} ·
            Total {bdt(total)}
          </p>
          <Button
            disabled={
              busy ||
              !current.eligible ||
              (!selected.length &&
                !Object.values(quantities).some((n) => n > 0))
            }
            onClick={checkout}
          >
            {busy ? "Reserving…" : "Continue to checkout"}
          </Button>
        </>
      ) : (
        <p>Availability is loading or temporarily unavailable.</p>
      )}
      <p role="status" className="mt-4">
        {message}
      </p>
      {login && (
        <Link className="text-link" href="/login">
          Sign in to reserve tickets
        </Link>
      )}
    </section>
  );
}
