import { motion } from "framer-motion";
import { type ChannelCheck } from "@shared/schema";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ChannelStatusGridProps {
  checks: ChannelCheck[];
  isLoading: boolean;
}

export function ChannelStatusGrid({ checks, isLoading }: ChannelStatusGridProps) {
  // Group by category
  const grouped = checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, ChannelCheck[]>);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-card/30 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card/20">
        <p className="text-muted-foreground">No active channel checks monitored.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Object.entries(grouped).map(([category, items], idx) => (
        <motion.div
          key={category}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.1 }}
          className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-lg flex flex-col"
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
            <h3 className="font-display font-semibold text-lg text-foreground">{category}</h3>
            <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
              {items.filter(i => i.isComplete).length}/{items.length} Done
            </span>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {items.sort((a, b) => {
              // Try to sort numerically if channelId is numeric
              const numA = parseInt(a.channelId.replace(/\D/g, ''));
              const numB = parseInt(b.channelId.replace(/\D/g, ''));
              if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
              return a.channelId.localeCompare(b.channelId);
            }).map((check) => (
              <Tooltip key={check.id}>
                <TooltipTrigger>
                  <div
                    className={`
                      aspect-square rounded-md flex items-center justify-center
                      border transition-all duration-300 relative
                      ${check.isComplete 
                        ? 'bg-green-500/20 border-green-500/50 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                        : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50'
                      }
                    `}
                  >
                    <span className="text-xs font-mono font-medium">{check.channelId}</span>
                    {check.isComplete && (
                      <span className="absolute inset-0 rounded-md animate-ping opacity-20 bg-green-500" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Channel {check.channelId}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {check.isComplete ? 'Completed' : 'Pending'}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
