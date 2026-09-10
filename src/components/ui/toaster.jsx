import { useToast } from "./use-toast";

export function Toaster() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts.map(({ id, title, description, variant }) => (
        <div
          key={id}
          className={`rounded-md border p-4 shadow-md bg-white animate-in slide-in-from-right-4 fade-in-80 duration-300 ${
            variant === "error"
              ? "border-red-200 text-red-900 bg-red-50"
              : "border-gray-200 text-gray-900"
          }`}
        >
          {title && <h3 className="font-semibold text-sm">{title}</h3>}
          {description && <p className="text-sm opacity-90">{description}</p>}
        </div>
      ))}
    </div>
  );
}
