export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card px-6 py-4">
      <p className="text-body text-muted-foreground">{label}</p>
      <p className="text-display-sm">{value}</p>
    </div>
  );
}
