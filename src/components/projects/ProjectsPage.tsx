import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStore } from '@/stores/dashboard-store';
import type { GoalRecord, FeatureRecord, BacklogRecord } from '@/stores/types';
import { cn } from '@/lib/utils';
import {
  FolderKanban,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  FileText,
  Palette,
  AlertTriangle,
  Zap,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import DirectivePipeline from './DirectivePipeline';
import ReportViewer from './ReportViewer';
import ReportsSection from './ReportsSection';
import LessonsSection from './LessonsSection';
import DiscussionsSection from './DiscussionsSection';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function lifecycleBadge(status: string) {
  switch (status) {
    case 'in-progress':
      return <Badge variant="outline" className="bg-status-yellow/15 text-status-yellow border-status-yellow/30 text-[10px] px-1.5 py-0">Active</Badge>;
    case 'done':
      return <Badge variant="outline" className="bg-status-green/15 text-status-green border-status-green/30 text-[10px] px-1.5 py-0">Done</Badge>;
    case 'blocked':
      return <Badge variant="outline" className="bg-status-red/15 text-status-red border-status-red/30 text-[10px] px-1.5 py-0">Blocked</Badge>;
    case 'pending':
    default:
      return <Badge variant="outline" className="bg-secondary text-muted-foreground border-border text-[10px] px-1.5 py-0">Pending</Badge>;
  }
}

function featureStatusIcon(status: string) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-3.5 w-3.5 text-status-green shrink-0" />;
    case 'in-progress':
      return <Loader2 className="h-3.5 w-3.5 text-status-yellow shrink-0 animate-spin" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Feature Row
// ---------------------------------------------------------------------------

function progressBarColor(status: string, pct: number): string {
  if (status === 'done' || pct === 100) return 'bg-status-green';
  if (status === 'in-progress') return 'bg-status-yellow';
  if (status === 'blocked') return 'bg-status-red';
  return 'bg-muted-foreground/50';
}

function FeatureRow({ feature, highlighted = false }: { feature: FeatureRecord; highlighted?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(highlighted);
  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const rawPct = feature.taskCount > 0
    ? Math.round((feature.completedTaskCount / feature.taskCount) * 100)
    : 0;
  const completionPct = feature.status === 'done' ? 100 : rawPct;

  return (
    <div ref={ref} className={cn("rounded-md hover:bg-accent/50 transition-colors cursor-pointer", highlighted && "ring-1 ring-primary/50 bg-primary/5")} onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-3 py-1.5 px-2">
        {featureStatusIcon(feature.status)}
        <span className={cn("text-xs truncate flex-1", feature.status === 'done' && "text-muted-foreground")}>{feature.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {feature.hasSpec && (
            <FileText className="h-3 w-3 text-muted-foreground" title="Has spec" />
          )}
          {feature.hasDesign && (
            <Palette className="h-3 w-3 text-muted-foreground" title="Has design" />
          )}
          <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
            {feature.completedTaskCount}/{feature.taskCount}
          </span>
          <div className="w-14">
            <Progress
              value={completionPct}
              className="h-1.5"
              indicatorClassName={progressBarColor(feature.status, completionPct)}
            />
          </div>
          <ChevronRight className={cn("h-3 w-3 text-muted-foreground/50 transition-transform", expanded && "rotate-90")} />
        </div>
      </div>
      {expanded && (
        <div className="px-2 pb-2 ml-6 border-l border-border/50 space-y-1.5">
          {feature.specSummary && (
            <div className="text-[10px] text-muted-foreground leading-relaxed">{feature.specSummary}</div>
          )}
          <div className="flex items-center gap-3 text-[10px]">
            <span className={cn(
              "font-medium",
              feature.status === 'done' ? 'text-status-green' : feature.status === 'in-progress' ? 'text-status-yellow' : feature.status === 'blocked' ? 'text-status-red' : 'text-muted-foreground'
            )}>
              {feature.status === 'in-progress' ? 'In Progress' : feature.status === 'done' ? 'Done' : feature.status === 'blocked' ? 'Blocked' : 'Pending'}
            </span>
            <span className="text-muted-foreground">{feature.completedTaskCount}/{feature.taskCount} tasks ({completionPct}%)</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
            {feature.hasSpec && <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" />Spec</span>}
            {feature.hasDesign && <span className="flex items-center gap-1"><Palette className="h-2.5 w-2.5" />Design</span>}
            <span className="font-mono">{feature.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backlog components
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

function sortByPriority(items: BacklogRecord[]): BacklogRecord[] {
  return [...items].sort((a, b) => {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] ?? 3 : 3;
    const pb = b.priority ? PRIORITY_ORDER[b.priority] ?? 3 : 3;
    return pa - pb;
  });
}

function backlogStatusIcon(status: string) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-3 w-3 text-status-green/60 shrink-0" />;
    case 'in-progress':
      return <Loader2 className="h-3 w-3 text-status-yellow shrink-0 animate-spin" />;
    case 'deferred':
      return <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />;
    case 'blocked':
      return <AlertTriangle className="h-3 w-3 text-status-red shrink-0" />;
    default:
      return <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />;
  }
}

function BacklogRow({ item, highlighted = false }: { item: BacklogRecord; highlighted?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(highlighted);
  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const priorityColor: Record<string, string> = {
    P0: 'text-status-red',
    P1: 'text-status-yellow',
    P2: 'text-muted-foreground',
  };

  const isDone = item.status === 'done';
  const isDeferred = item.status === 'deferred';

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-md hover:bg-accent/50 transition-colors cursor-pointer",
        highlighted && "ring-1 ring-primary/50 bg-primary/5"
      )}
      onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
    >
      <div className="flex items-start gap-2 py-1.5 px-2">
        {backlogStatusIcon(item.status)}
        <div className="flex-1 min-w-0">
          <span className={cn(
            "text-xs truncate block",
            isDone && "line-through text-muted-foreground/60",
            isDeferred && "text-muted-foreground/70 italic",
          )}>{item.title}</span>
          {!expanded && item.sourceContext && (
            <span className="text-[10px] text-muted-foreground block truncate">{item.sourceContext}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.priority && (
            <span className={cn("text-[10px] font-medium", priorityColor[item.priority] ?? 'text-muted-foreground')}>
              {item.priority}
            </span>
          )}
          <ChevronRight className={cn(
            "h-3 w-3 text-muted-foreground/40 transition-transform duration-150",
            expanded && "rotate-90"
          )} />
        </div>
      </div>
      {expanded && (
        <div className="px-2 pb-2 ml-5 space-y-1">
          {item.description && (
            <div className="text-[10px] text-muted-foreground leading-relaxed">{item.description}</div>
          )}
          {item.status !== 'pending' && (
            <div className="text-[10px] text-muted-foreground">
              <span className="text-muted-foreground/60">Status:</span> {item.status}
            </div>
          )}
          {item.trigger && (
            <div className="text-[10px] text-status-blue/70">
              <span className="text-muted-foreground/60">Trigger:</span> {item.trigger}
            </div>
          )}
          {item.sourceContext && (
            <div className="text-[10px] text-muted-foreground">
              <span className="text-muted-foreground/60">Source:</span> {item.sourceContext}
            </div>
          )}
          {item.sourceDirective && (
            <div className="text-[10px] text-muted-foreground">
              <span className="text-muted-foreground/60">Directive:</span> {item.sourceDirective}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground/50 font-mono">{item.id}</div>
        </div>
      )}
    </div>
  );
}

function BacklogSection({
  backlogs,
  showBacklog,
  setShowBacklog,
  highlightId,
}: {
  backlogs: BacklogRecord[];
  showBacklog: boolean;
  setShowBacklog: (v: boolean) => void;
  highlightId?: string;
}) {
  const pending = sortByPriority(backlogs.filter(b => b.status === 'pending' || b.status === 'in-progress' || b.status === 'blocked'));
  const deferred = sortByPriority(backlogs.filter(b => b.status === 'deferred'));
  const done = sortByPriority(backlogs.filter(b => b.status === 'done'));
  const [showDone, setShowDone] = useState(done.some(b => b.id === highlightId));

  const parts: string[] = [];
  if (pending.length > 0) parts.push(`${pending.length} active`);
  if (deferred.length > 0) parts.push(`${deferred.length} someday`);
  if (done.length > 0) parts.push(`${done.length} done`);
  const countDetail = parts.length > 1 ? ` · ${parts.join(', ')}` : '';

  return (
    <div className="pt-2">
      <button
        onClick={(e) => { e.stopPropagation(); setShowBacklog(!showBacklog); }}
        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium px-2 hover:text-foreground transition-colors cursor-pointer"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", showBacklog && "rotate-90")} />
        Backlog ({backlogs.length}){showBacklog && <span className="normal-case tracking-normal text-muted-foreground/50">{countDetail}</span>}
      </button>
      {showBacklog && (
        <div className="space-y-0.5 mt-1">
          {pending.map(b => (
            <BacklogRow key={b.id} item={b} highlighted={b.id === highlightId} />
          ))}
          {deferred.length > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium px-2 pt-2">
                Someday ({deferred.length})
              </div>
              {deferred.map(b => (
                <BacklogRow key={b.id} item={b} highlighted={b.id === highlightId} />
              ))}
            </>
          )}
          {done.length > 0 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDone(!showDone); }}
                className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground/40 font-medium px-2 pt-2 hover:text-muted-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className={cn("h-2.5 w-2.5 transition-transform", showDone && "rotate-90")} />
                Done ({done.length})
              </button>
              {showDone && done.map(b => (
                <BacklogRow key={b.id} item={b} highlighted={b.id === highlightId} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Card (flat list -- no group wrapper)
// ---------------------------------------------------------------------------

function GoalCard({
  goal,
  features,
  backlogs,
  initialOpen = false,
  highlightId,
}: {
  goal: GoalRecord;
  features: FeatureRecord[];
  backlogs: BacklogRecord[];
  initialOpen?: boolean;
  highlightId?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const backlogOnly = features.length === 0 && backlogs.length > 0;
  const [showBacklog, setShowBacklog] = useState(
    backlogOnly || backlogs.some(b => b.id === highlightId)
  );
  const activeFeatures = features.filter(f => f.status === 'in-progress');
  const doneFeatures = features.filter(f => f.status === 'done');
  const otherFeatures = features.filter(f => f.status !== 'in-progress' && f.status !== 'done');
  const hasIssues = (goal.issues?.length ?? 0) > 0;

  const displayStatus = (features.length === 0 && backlogs.length === 0 && goal.status === 'in-progress')
    ? 'pending'
    : goal.status;

  return (
    <Card>
      <CardContent className="p-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-full text-left p-3">
            <div className="flex items-center gap-2">
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                  open && "rotate-90"
                )}
              />
              <span className="text-sm font-medium truncate flex-1">{goal.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                {hasIssues && <AlertTriangle className="h-3 w-3 text-status-yellow" />}
                {goal.hasOkrs && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">OKR</Badge>
                )}
                {lifecycleBadge(displayStatus)}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-7 text-[10px] text-muted-foreground">
              <span>{activeFeatures.length + otherFeatures.length} open</span>
              <span className="text-border">|</span>
              <span>{doneFeatures.length} done</span>
              <span className="text-border">|</span>
              <span>{backlogs.length} backlog</span>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mx-3 mb-3 pl-4 border-l border-border space-y-0.5">
              {activeFeatures.length > 0 && (
                <div className="space-y-0.5">
                  {features.length > 3 && (
                    <div className="text-[9px] uppercase tracking-wider text-status-yellow/70 font-medium px-2 pt-1">
                      In Progress ({activeFeatures.length})
                    </div>
                  )}
                  {activeFeatures.map(f => (
                    <FeatureRow key={f.id} feature={f} highlighted={f.id === highlightId} />
                  ))}
                </div>
              )}
              {otherFeatures.length > 0 && (
                <div className="space-y-0.5">
                  {features.length > 3 && (
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium px-2 pt-1">
                      Pending ({otherFeatures.length})
                    </div>
                  )}
                  {otherFeatures.map(f => (
                    <FeatureRow key={f.id} feature={f} highlighted={f.id === highlightId} />
                  ))}
                </div>
              )}
              {doneFeatures.length > 0 && (
                <div className="space-y-0.5">
                  {features.length > 3 && (
                    <div className="text-[9px] uppercase tracking-wider text-status-green/70 font-medium px-2 pt-1">
                      Done ({doneFeatures.length})
                    </div>
                  )}
                  {doneFeatures.map(f => (
                    <FeatureRow key={f.id} feature={f} highlighted={f.id === highlightId} />
                  ))}
                </div>
              )}
              {features.length === 0 && backlogs.length === 0 && (
                <div className="text-xs text-muted-foreground py-2 px-2">No features yet</div>
              )}

              {backlogs.length > 0 && (
                <BacklogSection
                  backlogs={backlogs}
                  showBacklog={showBacklog}
                  setShowBacklog={setShowBacklog}
                  highlightId={highlightId}
                />
              )}

              {hasIssues && (
                <div className="pt-2 space-y-0.5">
                  {goal.issues!.map((issue, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-status-yellow py-0.5 px-2">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProjectsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staleness helper
// ---------------------------------------------------------------------------

function stalenessText(generated: string): string {
  const generatedDate = new Date(generated);
  const now = new Date();
  const diffMs = now.getTime() - generatedDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const workState = useDashboardStore((s) => s.workState);
  const goalInventory = useDashboardStore((s) => s.goalInventory);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'done'>('all');
  const [searchParams] = useSearchParams();
  const expandGoalId = searchParams.get('expand') ?? undefined;
  const highlightId = searchParams.get('highlight') ?? undefined;

  // Fetch work state on mount
  const fetchData = () => {
    setFetchAttempted(true);
    setLoading(true);
    setFetchError(null);
    Promise.all([
      fetch('http://localhost:4444/api/state/goals').then(r => { if (!r.ok) throw new Error(`Goals: ${r.status}`); return r.json(); }),
      fetch('http://localhost:4444/api/state/features').then(r => { if (!r.ok) throw new Error(`Features: ${r.status}`); return r.json(); }),
      fetch('http://localhost:4444/api/state/backlogs').then(r => { if (!r.ok) throw new Error(`Backlogs: ${r.status}`); return r.json(); }),
      fetch('http://localhost:4444/api/state/conductor').then(r => { if (!r.ok) throw new Error(`Conductor: ${r.status}`); return r.json(); }),
    ]).then(([goals, features, backlogs, conductor]) => {
      if (goals?.goals) {
        useDashboardStore.getState().setWorkState({ goals, features, backlogs, conductor, index: null });
      }
    }).catch((err) => {
      setFetchError(err.message ?? 'Failed to fetch project data');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (workState?.goals || fetchAttempted) return;
    fetchData();
  }, [workState?.goals, fetchAttempted]);

  // Compute data
  const { goals, allFeatures, allBacklogs, activeFeatures, directives, reports, discussions, lessons, generated, totalGoals, totalActiveFeatures, totalBacklog, totalDirectives, blockedCount } = useMemo(() => {
    const goals = workState?.goals?.goals ?? [];
    const features = workState?.features?.features ?? [];
    const backlogs = workState?.backlogs?.items ?? [];
    const directives = workState?.conductor?.directives ?? [];
    const reports = workState?.conductor?.reports ?? [];
    const discussions = workState?.conductor?.discussions ?? [];
    const lessons = workState?.conductor?.lessons ?? [];

    const activeFeatures = features.filter(f => f.status === 'in-progress' || f.status === 'blocked');

    return {
      goals,
      allFeatures: features,
      allBacklogs: backlogs,
      activeFeatures,
      directives,
      reports,
      discussions,
      lessons,
      generated: workState?.goals?.generated ?? '',
      totalGoals: goals.length,
      totalActiveFeatures: features.filter(f => f.status !== 'done').length,
      totalBacklog: backlogs.length,
      totalDirectives: directives.length,
      blockedCount: features.filter(f => f.status === 'blocked').length,
    };
  }, [workState]);

  // Goal name map for active work section
  const goalNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of workState?.goals?.goals ?? []) {
      map[g.id] = g.title;
    }
    return map;
  }, [workState?.goals]);

  // Filtered data
  const { filteredGoals, filteredDirectives, filteredReports, filteredLessons, filteredDiscussions, filteredActiveFeatures } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = (title: string) => !q || title.toLowerCase().includes(q);

    const matchesStatus = (status: string) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return status === 'in-progress';
      if (statusFilter === 'blocked') return status === 'blocked';
      if (statusFilter === 'done') return status === 'done';
      return true;
    };

    const filteredDirectives = directives.filter(d => matchesSearch(d.title));

    const filteredGoals = goals.filter(goal => {
      const goalFeatures = allFeatures.filter(f => f.goalId === goal.id);
      const goalBacklogs = allBacklogs.filter(b => b.goalId === goal.id);

      const goalMatchesSearch = matchesSearch(goal.title);
      const hasMatchingFeatures = goalFeatures.some(f => matchesSearch(f.title));
      const hasMatchingBacklogs = goalBacklogs.some(b => matchesSearch(b.title));

      const textMatch = goalMatchesSearch || hasMatchingFeatures || hasMatchingBacklogs;
      if (!textMatch) return false;

      if (statusFilter === 'all') return true;
      const goalStatusMatch = matchesStatus(goal.status);
      const hasStatusFeatures = goalFeatures.some(f => matchesStatus(f.status));
      return goalStatusMatch || hasStatusFeatures;
    });

    const filteredReports = reports.filter(r => matchesSearch(r.title));
    const filteredLessons = lessons.filter(l => matchesSearch(l.title));
    const filteredDiscussions = discussions.filter(d => matchesSearch(d.title));

    const filteredActiveFeatures = activeFeatures.filter(f => {
      if (!matchesSearch(f.title)) return false;
      if (statusFilter !== 'all' && !matchesStatus(f.status)) return false;
      return true;
    });

    return { filteredGoals, filteredDirectives, filteredReports, filteredLessons, filteredDiscussions, filteredActiveFeatures };
  }, [searchQuery, statusFilter, goals, allFeatures, allBacklogs, directives, reports, lessons, discussions, activeFeatures]);

  // Error state
  if (fetchError && !workState?.goals) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-status-red mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Failed to load project data
            </p>
            <p className="text-xs text-muted-foreground/60 mb-4">{fetchError}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback when no data at all
  if (!workState?.goals && !loading) {
    return <FallbackProjectsPage goalInventory={goalInventory} onRetry={fetchData} />;
  }

  if (loading) {
    return <ProjectsSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{totalGoals} goals</span>
          <span className="text-border">|</span>
          <span>{totalActiveFeatures} open features</span>
          <span className="text-border">|</span>
          <span>{totalBacklog} backlog</span>
          <span className="text-border">|</span>
          <span>{totalDirectives} directives</span>
          {blockedCount > 0 && (
            <>
              <span className="text-border">|</span>
              <span className="text-status-red">{blockedCount} blocked</span>
            </>
          )}
          {generated && (
            <>
              <span className="text-border">|</span>
              <span>Updated {stalenessText(generated)}</span>
            </>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 rounded-md hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh project data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search directives, goals, features..."
            className="h-8 text-xs pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'active', 'blocked', 'done'] as const).map(status => (
            <Badge
              key={status}
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 cursor-pointer transition-colors capitalize",
                statusFilter === status
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Badge>
          ))}
        </div>
      </div>

      {/* Report Viewer (overlay) */}
      {reportPath && (
        <ReportViewer reportPath={reportPath} onClose={() => setReportPath(null)} />
      )}

      {/* Directive Pipeline -- top of page */}
      <DirectivePipeline directives={filteredDirectives} onReportClick={setReportPath} />

      {/* Active Work -- in-progress + blocked features */}
      {filteredActiveFeatures.length > 0 && (() => {
        const inProgressFeatures = filteredActiveFeatures.filter(f => f.status === 'in-progress');
        const blockedActiveFeatures = filteredActiveFeatures.filter(f => f.status === 'blocked');
        return (
          <Card className="border-status-yellow/30 bg-status-yellow/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-status-yellow" />
                <span className="text-xs font-medium">Active Work</span>
                <Badge variant="outline" className="bg-status-yellow/15 text-status-yellow border-status-yellow/30 text-[10px] px-1.5 py-0">
                  {filteredActiveFeatures.length}
                </Badge>
              </div>
              {inProgressFeatures.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-status-yellow/70 font-medium px-2">
                    In Progress ({inProgressFeatures.length})
                  </div>
                  {inProgressFeatures.map(f => {
                    const pct = f.taskCount > 0 ? Math.round((f.completedTaskCount / f.taskCount) * 100) : 0;
                    return (
                      <div key={f.id} className="flex items-center gap-3 py-1 px-2 rounded-md hover:bg-accent/50 transition-colors">
                        <Loader2 className="h-3.5 w-3.5 text-status-yellow shrink-0 animate-spin" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs truncate block">{f.title}</span>
                          <span className="text-[10px] text-muted-foreground">{goalNameMap[f.goalId] ?? f.goalId}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {f.completedTaskCount}/{f.taskCount} ({pct}%)
                          </span>
                          <div className="w-14">
                            <Progress value={pct} className="h-1.5" indicatorClassName={progressBarColor(f.status, pct)} />
                          </div>
                          {lifecycleBadge(f.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {blockedActiveFeatures.length > 0 && (
                <div className={cn("space-y-1", inProgressFeatures.length > 0 && "mt-3")}>
                  <div className="text-[9px] uppercase tracking-wider text-status-red/70 font-medium px-2">
                    Blocked ({blockedActiveFeatures.length})
                  </div>
                  {blockedActiveFeatures.map(f => {
                    const pct = f.taskCount > 0 ? Math.round((f.completedTaskCount / f.taskCount) * 100) : 0;
                    return (
                      <div key={f.id} className="flex items-center gap-3 py-1 px-2 rounded-md hover:bg-accent/50 transition-colors border-l-2 border-status-red/50">
                        <AlertTriangle className="h-3.5 w-3.5 text-status-red shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs truncate block">{f.title}</span>
                          <span className="text-[10px] text-muted-foreground">{goalNameMap[f.goalId] ?? f.goalId}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {f.completedTaskCount}/{f.taskCount} ({pct}%)
                          </span>
                          <div className="w-14">
                            <Progress value={pct} className="h-1.5" indicatorClassName={progressBarColor(f.status, pct)} />
                          </div>
                          {lifecycleBadge(f.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Goals -- flat list */}
      <div className="space-y-3">
        {filteredGoals.map(goal => {
          let goalFeatures = allFeatures.filter(f => f.goalId === goal.id);
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const goalTitleMatch = goal.title.toLowerCase().includes(q);
            if (!goalTitleMatch) {
              goalFeatures = goalFeatures.filter(f => f.title.toLowerCase().includes(q));
            }
          }
          if (statusFilter !== 'all') {
            const statusMatch = (s: string) => statusFilter === 'active' ? s === 'in-progress' : statusFilter === 'blocked' ? s === 'blocked' : statusFilter === 'done' ? s === 'done' : true;
            if (!statusMatch(goal.status)) {
              goalFeatures = goalFeatures.filter(f => statusMatch(f.status));
            }
          }
          const goalBacklogs = allBacklogs.filter(b => b.goalId === goal.id);
          return (
            <GoalCard
              key={goal.id}
              goal={goal}
              features={goalFeatures}
              backlogs={goalBacklogs}
              initialOpen={goal.id === expandGoalId}
              highlightId={highlightId}
            />
          );
        })}
      </div>

      {/* Reports */}
      <ReportsSection reports={filteredReports} />

      {/* Lessons */}
      <LessonsSection lessons={filteredLessons} />

      {/* Discussions */}
      <DiscussionsSection discussions={filteredDiscussions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback view
// ---------------------------------------------------------------------------

function FallbackProjectsPage({
  goalInventory,
  onRetry,
}: {
  goalInventory: ReturnType<typeof useDashboardStore.getState>['goalInventory'];
  onRetry: () => void;
}) {
  if (!goalInventory) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No project data available yet.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
              Run the state indexer to generate project data, or ensure the conductor server is running on port 4444.
            </p>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { goals, generated } = goalInventory;
  const totalActiveFeatures = goals.reduce((sum, g) => sum + g.active_features.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{goals.length} goals</span>
          <span className="text-border">|</span>
          <span>{totalActiveFeatures} open features</span>
          <span className="text-border">|</span>
          <span>Updated {stalenessText(generated)}</span>
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Showing legacy inventory view. The full structured state data is not available yet.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Run <code className="font-mono bg-secondary px-1 rounded">npx tsx scripts/index-state.ts</code> to generate structured project data with directives, reports, lessons, and discussions.
          </p>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 text-xs text-primary hover:underline mt-3 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry loading structured data
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
