import { toast as sonnerToast } from "sonner";

export function toast({ title, description, variant, ...props }) {
  const message = description ? `${title}${title && description ? " - " : ""}${description}` : title;

  if (variant === "destructive") {
    return sonnerToast.error(title || message, {
      description,
      ...props,
    });
  }

  return sonnerToast(title || message, {
    description,
    ...props,
  });
}
