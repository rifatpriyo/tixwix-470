import { z } from "zod";
import { body, endpoint, json, mutationGuard } from "@/controllers/http";
import { requestContext } from "@/services/context";
import { requireViewer } from "@/services/authorization";
import { ReservationService } from "@/services/reservations";
import { ReservationRepository } from "@/repositories/reservations";
import { publicEvents } from "@/services/events";
import { checkoutSchema, seatingSchema } from "@/lib/reservations";
const uuid = z.string().uuid();
async function workflow(request: Request) {
  const context = await requestContext(request);
  requireViewer(context?.viewer ?? null);
  return new ReservationService(
    new ReservationRepository(context!.db),
    context!.viewer,
  );
}
export function availability(session: string) {
  return endpoint(async () =>
    json(
      await new ReservationRepository(publicEvents().db).availability(
        uuid.parse(session),
      ),
    ),
  );
}
export function createReservation(request: Request) {
  return endpoint(async () => {
    mutationGuard(request);
    const service = await workflow(request);
    return json(
      {
        reservation: await service.create(
          checkoutSchema.parse(await body(request)),
        ),
      },
      201,
    );
  });
}
export function reservation(request: Request, id: string, release = false) {
  return endpoint(async () => {
    if (release) mutationGuard(request);
    return json({
      reservation: await (await workflow(request)).get(uuid.parse(id), release),
    });
  });
}
export function assignSeating(request: Request, event: string) {
  return endpoint(async () => {
    mutationGuard(request);
    const service = await workflow(request);
    await service.seating(
      uuid.parse(event),
      seatingSchema.parse(await body(request)),
    );
    return json({
      message: "Seating saved. Refresh the event and submit it for review.",
    });
  });
}
