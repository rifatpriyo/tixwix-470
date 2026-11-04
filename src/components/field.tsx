import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ComponentProps } from "react";

type Props = ComponentProps<"input"> & {
  label: string;
  error?: string[];
  hint?: string;
  multiline?: boolean;
};
export function Field({ label, error, hint, multiline, ...props }: Props) {
  const id = props.id ?? props.name;
  const common = {
    id,
    name: props.name,
    required: props.required,
    disabled: props.disabled,
    defaultValue: props.defaultValue,
    maxLength: props.maxLength,
    "aria-invalid": !!error,
    "aria-describedby": `${id}-help`,
  };
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea {...common} rows={5} className="min-h-32 bg-white" />
      ) : (
        <Input {...props} {...common} className="h-11 bg-white" />
      )}
      <p
        id={`${id}-help`}
        className={error ? "text-sm text-destructive" : "subtle"}
      >
        {error?.[0] ?? hint}
      </p>
    </div>
  );
}
