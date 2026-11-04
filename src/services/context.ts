import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
import type { Role, Viewer } from "@/lib/domain";
import { AccountRepository } from "@/repositories/accounts";
import { AppError } from "@/lib/errors";

export async function requestContext(request?: Request) {
  if (!supabaseConfigured()) return null;
  const db = await serverClient(request);
  const header = request?.headers.get("authorization");
  if (header && !/^Bearer \S+$/i.test(header))
    throw new AppError(401, "Invalid authorization header.", "UNAUTHENTICATED");
  const token = header?.slice(7);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const accounts = new AccountRepository(db);
  const viewer: Viewer = {
    id: data.user.id,
    email: data.user.email ?? "",
    roles: await accounts.roles(data.user.id),
  };
  return { db, accounts, viewer };
}
export const pageContext = cache(() => requestContext());
export async function protectedPage(role?: Role) {
  const context = await pageContext();
  if (!context) redirect("/login");
  if (role && !context.viewer.roles.includes(role))
    redirect("/dashboard?notice=access");
  return context;
}
