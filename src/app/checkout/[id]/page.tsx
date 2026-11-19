import { notFound } from "next/navigation";
import { z } from "zod";
import { protectedPage } from "@/services/context";
import { PendingCheckout } from "@/components/pending-checkout";
export default async function Checkout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await protectedPage("customer");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return (
    <div className="page">
      <PendingCheckout id={id} />
    </div>
  );
}
