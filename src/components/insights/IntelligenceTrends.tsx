import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type {
  IntelligenceTrendsResult,
  IntelligenceAgentStats,
  IntelligenceCrossScoutSignal,
  IntelligenceTopicCluster,
} from '@/stores/types';

interface IntelligenceTrendsProps {
  data: IntelligenceTrendsResult | null;
}

// Agent display config
const AGENT_COLORS: Record<string, string> = {
  sarah: 'bg-violet-500',
  marcus: 'bg-blue-500',
  priya: 'bg-amber-500',
  morgan: 'bg-emerald-500',
};

const AGENT_LABELS: Record<string, string> = {
  sarah: 'Sarah (CTO)',
  marcus: 'Marcus (CPO)',
  priya: 'Priya (CMO)',
  morgan: 'Morgan (COO)',
};

const URGENCY_COLORS: Record<string, string> = {
  act_now: 'bg-red-500/10 text-red-400 border-red-500/20',
  this_week: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  this_month: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  fyi: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: 'bg-green-500/10 text-green-400 border-green-500/20',
  moderate: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  weak: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${URGENCY_COLORS[urgency] ?? URGENCY_COLORS.fyi}`}>
      {urgency.replace('_', ' ')}
    </Badge>
  );
}

function StrengthBadge({ strength }: { strength: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${STRENGTH_COLORS[strength] ?? STRENGTH_COLORS.weak}`}>
      {strength}
    </Badge>
  );
}

function AgentDot({ agent }: { agent: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${AGENT_COLORS[agent] ?? 'bg-gray-500'}`}
      title={AGENT_LABELS[agent] ?? agent}
    />
  );
}

// --- Summary cards ---

function SummaryCards({ data }: { data: IntelligenceTrendsResult }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="text-2xl font-bold">{data.totalFindings}</div>
          <div className="text-xs text-muted-foreground">Total Findings</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="text-2xl font-bold">{data.totalAccepted}/{data.totalProposals}</div>
          <div className="text-xs text-muted-foreground">Proposals Accepted</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="text-2xl font-bold">{data.overallAcceptanceRate}%</div>
          <div className="text-xs text-muted-foreground">Acceptance Rate</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="text-2xl font-bold">{data.crossScoutSignals.length}</div>
          <div className="text-xs text-muted-foreground">Cross-Scout Signals</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="text-2xl font-bold">{data.scoutDate ?? 'N/A'}</div>
          <div className="text-xs text-muted-foreground">Last Scout</div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Per-agent breakdown ---

function AgentBreakdown({ agents }: { agents: IntelligenceAgentStats[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Agent Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {agents.map((agent) => (
          <div key={agent.agent} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <AgentDot agent={agent.agent} />
              <span className="text-sm font-medium">{AGENT_LABELS[agent.agent] ?? agent.agent}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {agent.totalFindings} findings
              </span>
            </div>
            <div className="flex items-center gap-3 pl-4.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Acceptance: <span className="text-foreground font-medium">{agent.acceptanceRate}%</span></span>
                  <span>({agent.proposalsAccepted}/{agent.proposalsSubmitted} proposals)</span>
                </div>
                {/* Urgency bar */}
                <div className="flex gap-0.5 mt-1.5 h-2 rounded-full overflow-hidden bg-muted">
                  {Object.entries(agent.findingsByUrgency).map(([urgency, count]) => {
                    const pct = (count / agent.totalFindings) * 100;
                    const colors: Record<string, string> = {
                      act_now: 'bg-red-500',
                      this_week: 'bg-orange-500',
                      this_month: 'bg-blue-500',
                      fyi: 'bg-gray-500',
                    };
                    return (
                      <div
                        key={urgency}
                        className={`${colors[urgency] ?? 'bg-gray-500'} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${urgency}: ${count}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            {agent.topProducts.length > 0 && (
              <div className="flex gap-1 pl-4.5">
                {agent.topProducts.map((p) => (
                  <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                ))}
              </div>
            )}
          </div>
        ))}
        {/* Urgency legend */}
        <Separator className="my-2" />
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-500" /> act_now</div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-orange-500" /> this_week</div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-blue-500" /> this_month</div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-gray-500" /> fyi</div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Cross-scout signals ---

function CrossScoutSignals({ signals }: { signals: IntelligenceCrossScoutSignal[] }) {
  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Cross-Scout Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground py-4 text-center">
            No cross-scout patterns detected yet. Signals appear when 2+ agents report on the same topic.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Cross-Scout Signals
          <span className="text-xs text-muted-foreground font-normal ml-2">
            Topics confirmed by multiple agents
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((signal) => (
          <div key={signal.topic} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium capitalize">{signal.topic.replace(/-/g, ' ')}</span>
              <StrengthBadge strength={signal.strength} />
              <UrgencyBadge urgency={signal.highestUrgency} />
              {signal.shouldPromote && (
                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
                  auto-promote
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {signal.totalMentions} mentions
              </span>
            </div>
            <div className="flex items-center gap-1">
              {signal.agents.map((a) => (
                <div key={a} className="flex items-center gap-1">
                  <AgentDot agent={a} />
                  <span className="text-[10px] text-muted-foreground">{a}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {signal.items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AgentDot agent={item.agent} />
                  <span className="truncate flex-1">{item.title}</span>
                  <UrgencyBadge urgency={item.urgency} />
                </div>
              ))}
              {signal.items.length > 3 && (
                <div className="text-[10px] text-muted-foreground pl-4">
                  +{signal.items.length - 3} more items
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Top topics ---

function TopTopics({ topics }: { topics: IntelligenceTopicCluster[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Trending Topics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topics.map((topic) => {
            const maxWidth = topics[0]?.mentionCount ?? 1;
            const pct = Math.max(10, (topic.mentionCount / maxWidth) * 100);
            return (
              <div key={topic.topic} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize">{topic.topic.replace(/-/g, ' ')}</span>
                  <div className="flex items-center gap-1.5">
                    {topic.agents.map((a) => (
                      <AgentDot key={a} agent={a} />
                    ))}
                    <span className="text-muted-foreground ml-1">{topic.mentionCount}</span>
                    <UrgencyBadge urgency={topic.urgencyMax} />
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Product heatmap ---

function ProductHeatmap({ heatmap }: { heatmap: Record<string, number> }) {
  const entries = Object.entries(heatmap).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;

  const PRODUCT_COLORS: Record<string, string> = {
    buywisely: 'bg-blue-500',
    sellwisely: 'bg-purple-500',
    pricesapi: 'bg-amber-500',
    conductor: 'bg-emerald-500',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Product Coverage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map(([product, count]) => {
            const pct = Math.max(10, (count / max) * 100);
            return (
              <div key={product} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{product}</span>
                  <span className="text-muted-foreground">{count} findings</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${PRODUCT_COLORS[product] ?? 'bg-gray-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main component ---

export default function IntelligenceTrends({ data }: IntelligenceTrendsProps) {
  if (!data) {
    return (
      <div className="text-muted-foreground text-sm py-8 text-center">
        No intelligence data found. Run <code className="bg-muted px-1 rounded">/scout</code> to gather intelligence.
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <SummaryCards data={data} />

      {/* Cross-scout signals — most valuable, show first */}
      <CrossScoutSignals signals={data.crossScoutSignals} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AgentBreakdown agents={data.agentStats} />
        <div className="space-y-4">
          <TopTopics topics={data.topTopics} />
          <ProductHeatmap heatmap={data.productHeatmap} />
        </div>
      </div>
    </div>
  );
}
