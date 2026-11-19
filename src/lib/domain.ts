import type { Inventory, Reservation } from "./reservations";
import type { EventDetail, EventRecord, EventReview } from "./events";
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
      events: Table<EventRecord>;
      event_reviews: Table<EventReview>;
    };
    Views: { event_details: { Row: EventDetail; Relationships: [] } };
    Functions: {
      session_availability: { Args: { p_session: string }; Returns: Inventory };
      create_reservation: {
        Args: {
          p_session: string;
          p_key: string;
          p_seats: string[];
          p_ga: { category_id: string; quantity: number }[];
        };
        Returns: Reservation;
      };
      reservation: {
        Args: { p_id: string; p_release: boolean };
        Returns: Reservation;
      };
      assign_seating: {
        Args: {
          p_event: string;
          p_version: number;
          p_category: string;
          p_rows: number;
          p_columns: number;
        };
        Returns: undefined;
      };
      save_event: {
        Args: {
          p_id: string | null;
          p_version: number | null;
          p_data: Record<string, unknown>;
        };
        Returns: EventRecord;
      };
      transition_event: {
        Args: {
          p_id: string;
          p_version: number;
          p_action: string;
          p_feedback: string | null;
        };
        Returns: EventRecord;
      };
      search_events: {
        Args: {
          p_query: string;
          p_category: string;
          p_location: string;
          p_date: string | null;
          p_page: number;
        };
        Returns: {
          events: EventDetail[];
          total: number;
          page: number;
          pageSize: number;
        };
      };
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
