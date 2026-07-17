import { Github, Linkedin } from "lucide-react";

const WEBSITE = "https://www.deniskucevic.com/";
const GITHUB = "https://github.com/DeniKucevic";
const LINKEDIN = "https://www.linkedin.com/in/denis-kucevic/";

export function Footer() {
  return (
    <footer className="border-t mt-10">
      <div className="container mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} Fitness M</span>
        <span aria-hidden className="text-border">•</span>
        <span>
          Napravio{" "}
          <a
            href={WEBSITE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline-offset-4 hover:text-brand hover:underline transition-colors"
          >
            Denis Kučević
          </a>
        </span>
        <span className="inline-flex items-center gap-2.5 pl-1">
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-brand transition-colors">
            <Github className="h-4 w-4" />
          </a>
          <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-brand transition-colors">
            <Linkedin className="h-4 w-4" />
          </a>
        </span>
      </div>
    </footer>
  );
}
