import { Bot, LayoutDashboard, Database } from "lucide-react";
import { Link, useLocation } from "wouter";

export function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <Bot className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-tight">PokeBot</h1>
            <p className="text-xs text-muted-foreground">Reservation Dashboard</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/">
            <div className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2
              ${location === '/' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </div>
          </Link>
          <div className="w-px h-4 bg-border mx-2" />
          <a 
            href="https://discord.com" 
            target="_blank" 
            rel="noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Open Discord
          </a>
        </nav>
      </div>
    </header>
  );
}
