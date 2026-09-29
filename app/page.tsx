import { DashboardGrid } from "@/components/dashboard/dashboard-grid";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <section className="mb-8 max-w-3xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Jev + RawTree</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Jev-Assisted Pull Request Quality</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Review complete pull request diffs with Jev, retain structured quality events in RawTree,
          and compare contributors and repositories without counting reruns twice.
        </p>
      </section>
      <DashboardGrid />
    </div>
  );
}
