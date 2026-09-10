import { CalendarDays } from "lucide-react";

export default function LeaveManagement() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="hr-card flex flex-col items-center justify-center py-12 text-center border-dashed max-w-md w-full">
        <div className="hr-icon-box hr-tone-amber mb-4 size-14">
          <CalendarDays className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Leave Management</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Leave Management is not available in V1. This feature is coming soon.
        </p>
      </div>
    </main>
  );
}
