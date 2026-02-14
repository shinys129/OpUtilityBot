import { useState } from "react";
import { useAllSteals, useUserSteals } from "@/hooks/use-moderation";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Search, AlertTriangle, Clock, User, FileText } from "lucide-react";

export default function StealLog() {
  const { data: allSteals, isLoading } = useAllSteals();
  const [searchId, setSearchId] = useState("");
  const [lookupId, setLookupId] = useState<string | null>(null);
  const { data: lookupData } = useUserSteals(lookupId);

  const steals = (allSteals as any[]) || [];
  const lookupResult = lookupData as any;

  const handleLookup = () => {
    if (searchId.trim()) {
      setLookupId(searchId.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-background to-background border border-purple-500/10 p-8 md:p-12">
          <div className="relative z-10 max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-4"
            >
              Steal Log
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground"
            >
              Track and look up steals logged against users by staff.
            </motion.p>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground" data-testid="text-total-steals">Total Steals</CardTitle>
                <div className="p-2 rounded-lg bg-background/50 text-purple-400"><AlertTriangle className="w-4 h-4" /></div>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold font-display" data-testid="text-steals-count">{steals.length}</div></CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground" data-testid="text-users-with-steals">Users with Steals</CardTitle>
                <div className="p-2 rounded-lg bg-background/50 text-red-400"><User className="w-4 h-4" /></div>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold font-display" data-testid="text-users-steals-count">{new Set(steals.map((s: any) => s.userId)).size}</div></CardContent>
            </Card>
          </motion.div>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <span className="w-2 h-8 rounded-full bg-purple-500" />
            User Lookup
          </h2>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Discord User ID..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  data-testid="input-lookup-discord-id"
                />
                <Button onClick={handleLookup} data-testid="button-lookup">
                  <Search className="w-4 h-4 mr-2" />
                  Lookup
                </Button>
              </div>

              {lookupResult && (
                <div className="mt-6 space-y-4">
                  {lookupResult.user ? (
                    <>
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50 border border-border/30">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-display font-bold text-lg" data-testid="text-lookup-username">{lookupResult.user.username}</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-lookup-steals">
                            {lookupResult.totalSteals} steal{lookupResult.totalSteals !== 1 ? 's' : ''} on record
                          </p>
                        </div>
                      </div>

                      {lookupResult.steals.length > 0 ? (
                        <div className="rounded-xl border border-border/50 overflow-hidden">
                          <Table>
                            <TableHeader className="bg-secondary/50">
                              <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="text-muted-foreground font-semibold">Item Stolen</TableHead>
                                <TableHead className="text-muted-foreground font-semibold">Notes</TableHead>
                                <TableHead className="text-muted-foreground font-semibold">Logged By</TableHead>
                                <TableHead className="text-right text-muted-foreground font-semibold">Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lookupResult.steals.map((s: any) => (
                                <TableRow key={s.id} className="hover:bg-white/5 border-border/50" data-testid={`row-lookup-steal-${s.id}`}>
                                  <TableCell><span className="text-sm font-medium">{s.item}</span></TableCell>
                                  <TableCell>
                                    {s.notes ? (
                                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                        <FileText className="w-3 h-3" />
                                        {s.notes}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell><span className="text-sm text-muted-foreground">{s.staffUser?.username || 'Unknown'}</span></TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-xs">
                                      <Clock className="w-3 h-3" />
                                      {s.createdAt ? format(new Date(s.createdAt), 'MMM d, h:mm a') : '-'}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No steals recorded for this user.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4" data-testid="text-lookup-not-found">No records found for this Discord ID.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <span className="w-2 h-8 rounded-full bg-red-500" />
            All Steal Records
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 w-full bg-card/30 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Item Stolen</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Notes</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Logged By</TableHead>
                    <TableHead className="text-right text-muted-foreground font-semibold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steals.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No steals recorded yet.</TableCell></TableRow>
                  ) : (
                    steals.map((s: any, index: number) => (
                      <motion.tr key={s.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} className="group hover:bg-white/5 border-border/50 transition-colors" data-testid={`row-steal-${s.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20"><User className="w-3 h-3" /></div>
                            <span className="text-sm font-medium">{s.user?.username || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell><span className="text-sm font-medium">{s.item}</span></TableCell>
                        <TableCell>
                          {s.notes ? (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <FileText className="w-3 h-3" />
                              {s.notes}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{s.staffUser?.username || 'Unknown'}</span></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-xs">
                            <Clock className="w-3 h-3" />
                            {s.createdAt ? format(new Date(s.createdAt), 'MMM d, h:mm a') : '-'}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
