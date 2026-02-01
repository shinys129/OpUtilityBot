import { useReservations, useStats, useChannelChecks } from "@/hooks/use-dashboard";
import { ReservationTable } from "@/components/ReservationTable";
import { StatsCard } from "@/components/StatsCard";
import { ChannelStatusGrid } from "@/components/ChannelStatusGrid";
import { Header } from "@/components/Header";
import { Users, Layers, Activity, CheckSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: reservations, isLoading: isLoadingReservations } = useReservations();
  const { data: stats, isLoading: isLoadingStats } = useStats();
  const { data: checks, isLoading: isLoadingChecks } = useChannelChecks();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-primary/10 p-8 md:p-12">
          <div className="relative z-10 max-w-2xl">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-4"
            >
              Organization Status
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground"
            >
              Real-time overview of current reservations, pokemon selections, and channel completion status across all categories.
            </motion.p>
          </div>
          
          {/* Decorative background blur */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Total Reservations"
            value={stats?.totalReservations || 0}
            icon={Users}
            delay={0.1}
          />
          <StatsCard 
            title="Active Categories"
            value={stats ? Object.keys(stats.byCategory).length : 0}
            icon={Layers}
            color="text-purple-400"
            delay={0.2}
          />
          <StatsCard 
            title="Completion Rate"
            value={`${checks ? Math.round((checks.filter(c => c.isComplete).length / Math.max(checks.length, 1)) * 100) : 0}%`}
            icon={Activity}
            color="text-emerald-400"
            delay={0.3}
          />
          <StatsCard 
            title="Pending Actions"
            value={checks ? checks.filter(c => !c.isComplete).length : 0}
            icon={CheckSquare}
            color="text-amber-400"
            delay={0.4}
          />
        </div>

        {/* Live Channel Status */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <span className="w-2 h-8 rounded-full bg-primary" />
              Channel Status
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Updates
              </div>
            </div>
          </div>
          <ChannelStatusGrid checks={checks || []} isLoading={isLoadingChecks} />
        </section>

        {/* Reservations Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <span className="w-2 h-8 rounded-full bg-purple-500" />
              Recent Reservations
            </h2>
          </div>
          <ReservationTable 
            reservations={reservations || []} 
            isLoading={isLoadingReservations} 
          />
        </section>
      </main>
    </div>
  );
}
