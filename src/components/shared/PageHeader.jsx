export default function PageHeader({ icon: Icon, title, subtitle, tone = "coral", actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={`hr-mark hr-tone-${tone}`} aria-hidden="true">
              <Icon className="size-4" />
            </span>
          )}
          <h1 className="font-display truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
