import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { fetchAllLeaveRequests } from "@/services/leaveService";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

const formatDate = (ds) => {
  if (!ds) return "—";
  return new Date(ds).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function LeaveReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetchAllLeaveRequests();
        if (mounted) setData(res);
      } catch (err) {
        if (mounted) {
          toast({ title: "Error", description: err.message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [toast]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="hr-card p-0">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-amber">01</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Leave Requests Overview
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((req) => (
                <tr key={req.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {req.employees?.first_name} {req.employees?.last_name}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {req.employees?.employee_code}
                  </td>
                  <td className="px-5 py-3">
                    {formatDate(req.start_date)} - {formatDate(req.end_date)}
                  </td>
                  <td className="px-5 py-3 max-w-[200px] truncate" title={req.reason}>
                    {req.reason || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant="outline"
                      className={
                        req.status === "APPROVED"
                          ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                          : req.status === "REJECTED"
                            ? "border-coral-500 text-coral-600 bg-coral-50"
                            : "border-amber-500 text-amber-600 bg-amber-50"
                      }
                    >
                      {req.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
