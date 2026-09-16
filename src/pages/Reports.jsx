import { useNavigate } from "react-router-dom";
import { Activity, ArrowUpRight, CalendarDays, Clock3, Users, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const reportCategories = [
  {
    title: "Attendance Reports",
    description: "Daily, weekly, and monthly attendance summaries by employee and department.",
    icon: Clock3,
    tone: "cyan",
    count: 3,
    to: "/attendance",
  },
  {
    title: "Employee Reports",
    description: "Headcount, department distribution, turnover rate, and tenure analytics.",
    icon: Users,
    tone: "violet",
    count: 5,
    to: "/employees",
  },
  {
    title: "Leave Reports",
    description: "Leave utilisation, leave type breakdown, and pending approval reports.",
    icon: CalendarDays,
    tone: "amber",
    count: 4,
    to: "/reports/leave",
  },
  {
    title: "Expense Reports",
    description: "Category-wise expense analysis, budget variance, and approval funnel.",
    icon: WalletCards,
    tone: "coral",
    count: 6,
    to: "/bills",
  },
  {
    title: "Workforce Analytics",
    description:
      "Cross-module insights: productivity index, cost-per-employee, and workforce health.",
    icon: Activity,
    tone: "lime",
    count: 2,
    to: "/",
  },
];

export default function Reports() {
  const navigate = useNavigate();

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Intro banner */}
      <div className="hr-card border-dashed">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Browse available report categories below. Each category links to the corresponding module
          where you can filter, sort, and export data. Full export &amp; scheduling features will be
          available in a future release.
        </p>
      </div>

      {/* Report category grid */}
      <section
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Report categories"
      >
        {reportCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.title}
              className={`hr-card group cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]`}
              onClick={() => navigate(cat.to)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(cat.to)}
              aria-label={`Open ${cat.title}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`hr-icon-box hr-tone-${cat.tone}`}>
                  <Icon className="size-5" />
                </div>
                <Badge className={`hr-soft-badge hr-tone-${cat.tone}`}>
                  <span className="hr-mini-dot" />
                  {cat.count} reports
                </Badge>
              </div>
              <h2 className="font-display mt-4 text-lg font-bold tracking-tight text-foreground">
                {cat.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {cat.description}
              </p>
              <div
                className="mt-4 flex items-center gap-1 text-xs font-medium"
                style={{ color: `var(--hr-${cat.tone})` }}
              >
                View data <ArrowUpRight className="size-3.5" />
              </div>
            </div>
          );
        })}
      </section>

      {/* Coming soon placeholder */}
      <div className="hr-card flex flex-col items-center justify-center py-10 text-center border-dashed">
        <div className="hr-icon-box hr-tone-slate mb-4 size-14">
          <Activity className="size-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">Full Report Builder — Coming Soon</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Schedule automatic reports, export to PDF/Excel, and set up email delivery in a future
          update.
        </p>
        <Button variant="outline" size="sm" className="mt-5 gap-1.5" disabled>
          Request Early Access
        </Button>
      </div>
    </main>
  );
}
