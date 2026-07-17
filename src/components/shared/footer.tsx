import { Github, Linkedin } from "lucide-react";

const WEBSITE = "https://www.deniskucevic.com/";
const GITHUB = "https://github.com/DeniKucevic";
const LINKEDIN = "https://www.linkedin.com/in/denis-kucevic/";

export function Footer() {
  return (
    <footer className="border-t mt-10">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span>
          © {new Date().getFullYear()} Fitness M · Napravio{" "}
          <a
            href={WEBSITE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Deni Kučević
          </a>
        </span>
        <span className="flex items-center gap-3">
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-foreground">
            <Github className="h-4 w-4" />
          </a>
          <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-foreground">
            <Linkedin className="h-4 w-4" />
          </a>
        </span>
      </div>
    </footer>
  );
}
