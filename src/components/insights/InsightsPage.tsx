import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { StatsCache, IntelligenceTrendsResult } from '@/stores/types';
import UsageStats from './UsageStats';
import IntelligenceTrends from './IntelligenceTrends';

const API_BASE = `http://${window.location.hostname}:4444`;

export default function InsightsPage() {
  const [stats, setStats] = useState<StatsCache | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceTrendsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/insights/stats`).then((r) => r.json()).catch(() => null),
      fetch(`${API_BASE}/api/intelligence`).then((r) => r.json()).catch(() => null),
    ])
      .then(([statsData, intelData]) => {
        setStats(statsData);
        setIntelligence(intelData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="intelligence" className="w-full">
        <TabsList>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="usage">Usage Stats</TabsTrigger>
        </TabsList>
        <TabsContent value="intelligence">
          <IntelligenceTrends data={intelligence} />
        </TabsContent>
        <TabsContent value="usage">
          <UsageStats stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
