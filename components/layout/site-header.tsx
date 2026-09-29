import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LINKS } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/rawtree-logo.svg"
            alt="Jev PR Quality"
            width={24}
            height={28}
            className="h-7 w-auto"
          />
          <span className="text-lg font-semibold tracking-tight">
            Jev PR Quality
          </span>
        </Link>

        <nav className="ml-8 hidden items-center gap-6 text-sm md:flex">
          <a
            href={LINKS.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            RawTree Docs
            <ExternalLink className="size-3" />
          </a>
          <a
            href={LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
            <ExternalLink className="size-3" />
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
