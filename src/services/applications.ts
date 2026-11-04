import "server-only";
import type { Viewer, ApplicationStatus } from "@/lib/domain";
import type { ApplicationInput, ReviewInput } from "@/lib/validation";
import { ApplicationRepository } from "@/repositories/applications";
import { requireRole, requireViewer } from "@/services/authorization";
import { AppError } from "@/lib/errors";

export class ApplicationService {
  constructor(
    private repository: ApplicationRepository,
    private viewer: Viewer | null,
  ) {}
  async own() {
    const viewer = requireViewer(this.viewer);
    const applications = await this.repository.own(viewer.id);
    return {
      application: applications[0] ?? null,
      applications,
      reviews: await this.repository.reviews(applications.map((a) => a.id)),
    };
  }
  async submit(input: ApplicationInput) {
    const viewer = requireViewer(this.viewer);
    if (viewer.roles.includes("host"))
      throw new AppError(
        409,
        "Your host access is already approved.",
        "ALREADY_HOST",
      );
    // The database owns transitions, concurrency, and ownership validation.
    return this.repository.submit(input);
  }
  async list(status: ApplicationStatus | "all", page: number) {
    requireRole(this.viewer, "admin");
    return this.repository.list(status, page);
  }
  async detail(id: string) {
    requireRole(this.viewer, "admin");
    const application = await this.repository.find(id);
    if (!application)
      throw new AppError(404, "Application not found.", "NOT_FOUND");
    const applications = await this.repository.own(application.applicant_id);
    return {
      application,
      applications,
      reviews: await this.repository.reviews(applications.map((a) => a.id)),
    };
  }
  async review(id: string, input: ReviewInput) {
    requireRole(this.viewer, "admin");
    return this.repository.review(id, input);
  }
}
