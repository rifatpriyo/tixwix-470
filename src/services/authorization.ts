import type { Role, Viewer } from "@/lib/domain";
import { AppError } from "@/lib/errors";
export function requireViewer(viewer: Viewer | null): Viewer {
  if (!viewer)
    throw new AppError(401, "Sign in to continue.", "UNAUTHENTICATED");
  return viewer;
}
export function requireRole(viewer: Viewer | null, role: Role): Viewer {
  const actor = requireViewer(viewer);
  if (!actor.roles.includes(role))
    throw new AppError(
      403,
      `This action requires ${role} access.`,
      "FORBIDDEN",
    );
  return actor;
}
