import { LINKS } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
        <p>
          Jev-assisted PR review analytics powered by{" "}
          <a
            href={LINKS.rawtree}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            RawTree
          </a>
        </p>
      </div>
    </footer>
  );
}
