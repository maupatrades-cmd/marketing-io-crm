import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  // Filter out toasts whose `open` was flipped to false by dismiss(). Without
  // this the toast keeps rendering until TOAST_REMOVE_DELAY purges it from
  // state, which made the X button look unresponsive.
  const visibleToasts = toasts.filter((t) => t.open !== false);

  return (
    <ToastProvider>
      {visibleToasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast
            key={id}
            {...props}
            onClick={() => dismiss(id)}
            className="cursor-pointer"
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                dismiss(id);
              }}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}