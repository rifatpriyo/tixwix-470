export type Role = "customer" | "host" | "admin";
export type ApplicationStatus = "pending" | "approved" | "rejected";
export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};
export type UserRole = {
  user_id: string;
  role: Role;
  granted_by: string | null;
  created_at: string;
};
export type HostApplication = {
  id: string;
  applicant_id: string;
  previous_application_id: string | null;
  organizer_name: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};
export type HostProfile = {
  user_id: string;
  application_id: string;
  organizer_name: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  approved_at: string;
};
export type Review = {
  id: string;
  application_id: string;
  reviewer_id: string | null;
  decision: "approved" | "rejected";
  feedback: string | null;
  created_at: string;
};
export type Viewer = { id: string; email: string; roles: Role[] };
type Table<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      user_roles: Table<UserRole>;
      host_applications: Table<HostApplication>;
      host_profiles: Table<HostProfile>;
      host_application_reviews: Table<Review>;
    };
    Views: { [_ in never]: never };
    Functions: {
      has_role: { Args: { requested_role: string }; Returns: boolean };
      submit_host_application: {
        Args: {
          p_organizer_name: string;
          p_contact_email: string;
          p_contact_phone: string;
          p_description: string;
        };
        Returns: HostApplication;
      };
      review_host_application: {
        Args: {
          p_application_id: string;
          p_decision: string;
          p_feedback: string | null;
        };
        Returns: HostApplication;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
