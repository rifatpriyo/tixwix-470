export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "23505")
    throw new AppError(
      409,
      "This application is already pending or has been reviewed. Refresh to see its status.",
      "CONFLICT",
    );
  if (error.code === "42501")
    throw new AppError(
      403,
      "You do not have permission to perform this action.",
      "FORBIDDEN",
    );
  if (["23514", "23502", "22023"].includes(error.code ?? ""))
    throw new AppError(
      422,
      "Check the application fields and try again.",
      "VALIDATION_ERROR",
    );
  if (error.code === "P0002")
    throw new AppError(404, "Application not found.", "NOT_FOUND");
  throw new AppError(
    503,
    "Account data is temporarily unavailable. Please try again.",
    "DATABASE_UNAVAILABLE",
  );
}
