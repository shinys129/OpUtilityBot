import { useAuditLogs, useWarnings, useBans, useMutes } from "@/hooks/use-moderation";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Shield, AlertTriangle, Ban, VolumeX, Clock, User } from "lucide-react";

function getActionBadge(action: string) {
  switch (action) {
    case 'warn':
      return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Warning</Badge>;
    case 'mute':
      return <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30">Mute</Badge>;
    case 'unmute':
      return <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30">Unmute</Badge>;
    case 'ban':
      return <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">Ban</Badge>;
    case 'unban':
      return <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Unban</Badge>;
    case 'steal_logged':
      return <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30">Steal</Badge>;
    default:
      return <Badge variant="outline">{action}</Badge>;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 w-full bg-card/30 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

export default function ModerationLog() {
  const { data: auditLogs, isLoading: loadingLogs } = useAuditLogs();
  const { data: warnings, isLoading: loadingWarnings } = useWarnings();
  const { data: bans, isLoading: loadingBans } = useBans();
  const { data: mutes, isLoading: loadingMutes } = useMutes();

  const logs = (auditLogs as any[]) || [];
  const warnList = (warnings as any[]) || [];
  const banList = (bans as any[]) || [];
  const muteList = (mutes as any[]) || [];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-background to-background border border-red-500/10 p-8 md:p-12">
          <div className="relative z-10 max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-4"
            >
              Moderation Log
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground"
            >
              Track all staff actions including warnings, mutes, and bans.
            </motion.p>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground" data-testid="text-total-actions">Total Actions</CardTitle>
                <div className="p-2 rounded-lg bg-background/50 text-primary"><Shield className="w-4 h-4" /></div>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold font-display" data-testid="text-total-actions-count">{logs.length}</div></CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground" data-testid="text-active-warnings">Active Warnings</CardTitle>
                <div className="p-2 rounded-lg bg-background/50 text-yellow-400"><AlertTriangle className="w-4 h-4" /></div>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold font-display" data-testid="text-warnings-count">{warnList.filter((w: any) => w.isActive).length}</div></CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground" data-testid="text-active-bans">Active Bans</CardTitle>
                <div className="p-2 rounded-lg bg-background/50 text-red-400"><Ban className="w-4 h-4" /></div>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold font-display" data-testid="text-bans-count">{banList.length}</div></CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground" data-testid="text-active-mutes">Active Mutes</CardTitle>
                <div className="p-2 rounded-lg bg-background/50 text-orange-400"><VolumeX className="w-4 h-4" /></div>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold font-display" data-testid="text-mutes-count">{muteList.length}</div></CardContent>
            </Card>
          </motion.div>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList data-testid="tabs-moderation">
            <TabsTrigger value="all" data-testid="tab-all-actions">All Actions</TabsTrigger>
            <TabsTrigger value="warnings" data-testid="tab-warnings">Warnings</TabsTrigger>
            <TabsTrigger value="bans" data-testid="tab-bans">Bans</TabsTrigger>
            <TabsTrigger value="mutes" data-testid="tab-mutes">Mutes</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {loadingLogs ? <LoadingSkeleton /> : (
              <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-muted-foreground font-semibold">Action</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Staff</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Target</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Details</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No moderation actions recorded yet.</TableCell></TableRow>
                    ) : (
                      logs.map((log: any, index: number) => (
                        <motion.tr key={log.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} className="group hover:bg-white/5 border-border/50 transition-colors" data-testid={`row-audit-${log.id}`}>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20"><User className="w-3 h-3" /></div>
                              <span className="text-sm font-medium">{log.admin?.username || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.targetUser ? (
                              <span className="text-sm">{log.targetUser.username}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{(log.details as any)?.reason || (log.details as any)?.item || '-'}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-xs">
                              <Clock className="w-3 h-3" />
                              {log.createdAt ? format(new Date(log.createdAt), 'MMM d, h:mm a') : '-'}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="warnings">
            {loadingWarnings ? <LoadingSkeleton /> : (
              <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Reason</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Warned By</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warnList.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No warnings issued.</TableCell></TableRow>
                    ) : (
                      warnList.map((w: any, index: number) => (
                        <motion.tr key={w.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} className="group hover:bg-white/5 border-border/50 transition-colors" data-testid={`row-warning-${w.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 border border-yellow-500/20"><User className="w-3 h-3" /></div>
                              <span className="text-sm font-medium">{w.user?.username || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell><span className="text-sm">{w.reason}</span></TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{w.warnedByUser?.username || 'Unknown'}</span></TableCell>
                          <TableCell>{w.isActive ? <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Active</Badge> : <Badge variant="secondary">Cleared</Badge>}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-xs"><Clock className="w-3 h-3" />{w.warnedAt ? format(new Date(w.warnedAt), 'MMM d, h:mm a') : '-'}</div>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bans">
            {loadingBans ? <LoadingSkeleton /> : (
              <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Reason</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Banned By</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Expires</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banList.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No active bans.</TableCell></TableRow>
                    ) : (
                      banList.map((b: any, index: number) => (
                        <motion.tr key={b.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} className="group hover:bg-white/5 border-border/50 transition-colors" data-testid={`row-ban-${b.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 border border-red-500/20"><User className="w-3 h-3" /></div>
                              <span className="text-sm font-medium">{b.user?.username || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell><span className="text-sm">{b.reason}</span></TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{b.bannedByUser?.username || 'Unknown'}</span></TableCell>
                          <TableCell>{b.expiresAt ? <span className="text-sm">{format(new Date(b.expiresAt), 'MMM d, yyyy')}</span> : <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">Permanent</Badge>}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-xs"><Clock className="w-3 h-3" />{b.bannedAt ? format(new Date(b.bannedAt), 'MMM d, h:mm a') : '-'}</div>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mutes">
            {loadingMutes ? <LoadingSkeleton /> : (
              <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Reason</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Muted By</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Expires</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {muteList.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No active mutes.</TableCell></TableRow>
                    ) : (
                      muteList.map((m: any, index: number) => (
                        <motion.tr key={m.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} className="group hover:bg-white/5 border-border/50 transition-colors" data-testid={`row-mute-${m.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 border border-orange-500/20"><User className="w-3 h-3" /></div>
                              <span className="text-sm font-medium">{m.user?.username || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell><span className="text-sm">{m.reason}</span></TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{m.mutedByUser?.username || 'Unknown'}</span></TableCell>
                          <TableCell>{m.expiresAt ? <span className="text-sm">{format(new Date(m.expiresAt), 'MMM d, h:mm a')}</span> : <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30">Indefinite</Badge>}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-xs"><Clock className="w-3 h-3" />{m.mutedAt ? format(new Date(m.mutedAt), 'MMM d, h:mm a') : '-'}</div>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
