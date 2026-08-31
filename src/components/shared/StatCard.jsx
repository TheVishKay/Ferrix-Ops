import { Badge } from "@/components/ui/badge";

export default function StatCard({ label, value, helper, trend, icon: Icon, tone = "cyan" }) {
  return (
    <div className="hr-card hr-metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className={`hr-icon-box hr-tone-${tone}`}>
          {Icon && <Icon className="size-[18px]" />}
        </div>
        {trend && (
          <Badge className={`hr-soft-badge hr-tone-${tone}`}>
            <span className="hr-mini-dot" />
            {trend}
          </Badge>
        )}
      </div>
      <p className="font-display mt-4 truncate text-[28px] font-black leading-none tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 truncate text-sm font-medium text-foreground">{label}</p>
      {helper && <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
