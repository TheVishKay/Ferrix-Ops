export default function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="hr-icon-box hr-tone-slate mb-4 size-14">
          <Icon className="size-6" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
