import { protectedPage } from "@/services/context";
import { EventEditor } from "@/components/event-editor";
export default async function CreateEvent() {
  await protectedPage("host");
  return (
    <div className="page">
      <h1 className="page-title">Create event</h1>
      <p className="mt-3 text-muted-foreground">
        Start with a draft. You can return and complete it later.
      </p>
      <EventEditor />
    </div>
  );
}
