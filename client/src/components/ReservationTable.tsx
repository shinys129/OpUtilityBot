import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import type { ReservationWithUser } from "@shared/schema";
import { User, Clock, Hash } from "lucide-react";

interface ReservationTableProps {
  reservations: ReservationWithUser[];
  isLoading: boolean;
}

export function ReservationTable({ reservations, isLoading }: ReservationTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-card/30 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'rares': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'regionals': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'gmax': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'eevos': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      case 'missingno': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl">
      <Table>
        <TableHeader className="bg-secondary/50">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-[200px] text-muted-foreground font-semibold">User</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Category</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Details</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Pokemon Selection</TableHead>
            <TableHead className="text-right text-muted-foreground font-semibold">Channels</TableHead>
            <TableHead className="text-right text-muted-foreground font-semibold">Reserved At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No reservations found. Start by using <code className="bg-secondary px-2 py-1 rounded">/startorg</code> in Discord.
              </TableCell>
            </TableRow>
          ) : (
            reservations.map((res, index) => (
              <motion.tr
                key={res.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group hover:bg-white/5 border-border/50 transition-colors"
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="font-display tracking-tight text-foreground">{res.user.username}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`${getCategoryColor(res.category)} font-mono`}>
                    {res.category}
                  </Badge>
                  {res.subCategory && (
                    <Badge variant="secondary" className="ml-2 text-xs bg-secondary/50">
                      {res.subCategory}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                   {/* Placeholder for dynamic details if needed */}
                   <span className="text-sm text-muted-foreground">-</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {res.pokemon1 && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {res.pokemon1}
                      </span>
                    )}
                    {res.pokemon2 && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                        {res.pokemon2}
                      </span>
                    )}
                    {res.additionalPokemon && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        + {res.additionalPokemon}
                      </span>
                    )}
                    {!res.pokemon1 && !res.pokemon2 && (
                      <span className="text-muted-foreground italic text-xs">Pending selection...</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5 text-muted-foreground font-mono">
                    <Hash className="w-3 h-3" />
                    {res.channelRange || "N/A"}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-xs">
                    <Clock className="w-3 h-3" />
                    {res.createdAt ? format(new Date(res.createdAt), 'MMM d, h:mm a') : '-'}
                  </div>
                </TableCell>
              </motion.tr>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
