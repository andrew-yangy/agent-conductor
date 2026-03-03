import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboard-store';
import { timeAgo } from '@/lib/utils';
import {
  FileText,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Ban,
  Zap,
  Target,
  CheckCircle2,
} from 'lucide-react';
import type { ArtifactRecord, GoalRecord, FeatureRecord, DirectiveRecord } from '@/stores/types';

// ---------------------------------------------------------------------------
// Simple inline markdown renderer (headings, bold, lists)
// ---------------------------------------------------------------------------

function renderBriefMarkdown(md: string, maxLines = 20) {
  const lines = md.split('\n').slice(0, maxLines);
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('```')) continue; // skip code fences

    if (line.startsWith('# ') && key === 0) {
      key++;
      continue; // skip title
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={key++} className="text-xs font-semibold text-foreground mt-2 mb-0.5">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h4 key={key++} className="text-xs font-medium text-foreground mt-1.5 mb-0.5">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.slice(2);
      // Bold handling
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <div key={key++} className="text-[11px] text-muted-foreground leading-relaxed pl-3 flex gap-1.5">
          <span className="shrink-0">·</span>
          <span>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-foreground font-medium">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-0.5" />);
    } else if (line.startsWith('|')) {
      // skip tables
    } else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={key++} className="text-[11px] text-muted-foreground leading-relaxed">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-foreground font-medium">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    }
  }

  return elements;
}

// ---------------------------------------------------------------------------
// CEO Brief Component
// ---------------------------------------------------------------------------

export default function CeoBrief() {
  const workState = useDashboardStore((s) => s.workState);
  const navigate = useNavigate();
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [showAllReports, setShowAllReports] = useState(false);

  // Get recent reports (up to 5, sorted by date descending)
  const recentReports = useMemo(() => {
    const reports = workState?.conductor?.reports ?? [];
    if (reports.length === 0) return [];
    return [...reports]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [workState?.conductor]);

  const latestReport = recentReports[0] ?? null;

  // Load a specific report's content
  const loadReport = useCallback((report: ArtifactRecord) => {
    if (!report.filePath) return;
    setLoadingReport(true);
    fetch(`http://localhost:4444/api/state/artifact-content?path=${encodeURIComponent(report.filePath)}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.text();
      })
      .then(text => setReportContent(text))
      .catch(() => setReportContent(null))
      .finally(() => setLoadingReport(false));
  }, []);

  // Auto-load latest report content
  useEffect(() => {
    if (latestReport && !reportContent && !loadingReport) {
      loadReport(latestReport);
    }
  }, [latestReport, reportContent, loadingReport, loadReport]);

  // Toggle report expansion - load content on expand
  const toggleReport = useCallback((report: ArtifactRecord) => {
    if (expandedReportId === report.id) {
      setExpandedReportId(null);
    } else {
      setExpandedReportId(report.id);
      // Reload content for the newly expanded report
      setReportContent(null);
      loadReport(report);
    }
  }, [expandedReportId, loadReport]);

  // Compute attention items and completions
  const { goalsWithIssues, blockedFeatures, activeFeatures, recentCompletions } = useMemo(() => {
    const goals = workState?.goals?.goals ?? [];
    const features = workState?.features?.features ?? [];
    const directives = workState?.conductor?.directives ?? [];

    // Done directives sorted by date, most recent first
    const doneDirectives = directives
      .filter((d: DirectiveRecord) => d.status === 'completed')
      .sort((a: DirectiveRecord, b: DirectiveRecord) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 5);

    return {
      goalsWithIssues: goals.filter((g: GoalRecord) => (g.issues?.length ?? 0) > 0),
      blockedFeatures: features.filter((f: FeatureRecord) => f.status === 'blocked'),
      activeFeatures: features.filter((f: FeatureRecord) => f.status === 'in_progress'),
      recentCompletions: doneDirectives,
    };
  }, [workState]);

  const hasAnything = recentReports.length > 0
    || goalsWithIssues.length > 0
    || blockedFeatures.length > 0
    || activeFeatures.length > 0
    || recentCompletions.length > 0;

  if (!hasAnything) return null;

  const totalReportCount = workState?.conductor?.reports?.length ?? 0;

  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        CEO Brief
      </h2>
      <div className="space-y-3">
        {/* Attention items — blocked + issues */}
        {(blockedFeatures.length > 0 || goalsWithIssues.length > 0) && (
          <Card className="border-status-yellow/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-status-yellow" />
                <span className="text-xs font-medium">Needs Attention</span>
                <Badge variant="outline" className="bg-status-yellow/15 text-status-yellow border-status-yellow/30 text-[10px] px-1.5 py-0">
                  {blockedFeatures.length + goalsWithIssues.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {blockedFeatures.map(f => (
                  <button
                    key={f.id}
                    className="flex items-center gap-2 w-full text-left hover:bg-secondary/50 rounded px-2 py-1 -mx-1 transition-colors cursor-pointer"
                    onClick={() => navigate(`/projects?expand=${f.goalId}&highlight=${f.id}`)}
                  >
                    <Ban className="h-3 w-3 text-status-red shrink-0" />
                    <span className="text-xs truncate flex-1">{f.title}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-status-red/10 text-status-red border-status-red/30">blocked</Badge>
                  </button>
                ))}
                {goalsWithIssues.map(g => (
                  <button
                    key={g.id}
                    className="flex items-center gap-2 w-full text-left hover:bg-secondary/50 rounded px-2 py-1 -mx-1 transition-colors cursor-pointer"
                    onClick={() => navigate(`/projects?expand=${g.id}`)}
                  >
                    <AlertTriangle className="h-3 w-3 text-status-yellow shrink-0" />
                    <span className="text-xs truncate flex-1">{g.title}</span>
                    <span className="text-[9px] text-status-yellow">{g.issues!.length} issue{g.issues!.length !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active features summary */}
        {activeFeatures.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-status-yellow" />
                <span className="text-xs font-medium">In Progress</span>
                <Badge variant="outline" className="bg-status-yellow/15 text-status-yellow border-status-yellow/30 text-[10px] px-1.5 py-0">
                  {activeFeatures.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {activeFeatures.slice(0, 5).map(f => {
                  const pct = f.taskCount > 0 ? Math.round((f.completedTaskCount / f.taskCount) * 100) : 0;
                  return (
                    <button
                      key={f.id}
                      className="flex items-center gap-2 w-full text-left hover:bg-secondary/50 rounded px-2 py-1 -mx-1 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projects?expand=${f.goalId}&highlight=${f.id}`)}
                    >
                      <Target className="h-3 w-3 text-status-yellow shrink-0" />
                      <span className="text-xs truncate flex-1">{f.title}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {f.completedTaskCount}/{f.taskCount} ({pct}%)
                      </span>
                    </button>
                  );
                })}
                {activeFeatures.length > 5 && (
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 cursor-pointer"
                    onClick={() => navigate('/projects')}
                  >
                    +{activeFeatures.length - 5} more
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent completions */}
        {recentCompletions.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-green" />
                <span className="text-xs font-medium">Recently Completed</span>
                <Badge variant="outline" className="bg-status-green/15 text-status-green border-status-green/30 text-[10px] px-1.5 py-0">
                  {recentCompletions.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {recentCompletions.map(d => (
                  <button
                    key={d.id}
                    className="flex items-center gap-2 w-full text-left hover:bg-secondary/50 rounded px-2 py-1 -mx-1 transition-colors cursor-pointer"
                    onClick={() => navigate('/artifacts?tab=reports')}
                  >
                    <CheckCircle2 className="h-3 w-3 text-status-green shrink-0" />
                    <span className="text-xs truncate flex-1">{d.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(d.updatedAt)}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent reports */}
        {recentReports.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-3.5 w-3.5 text-status-green" />
                <span className="text-xs font-medium">Recent Reports</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {totalReportCount}
                </Badge>
              </div>
              <div className="space-y-1">
                {(showAllReports ? recentReports : recentReports.slice(0, 3)).map(report => (
                  <div key={report.id}>
                    <button
                      className="flex items-center gap-2 w-full text-left hover:bg-secondary/50 rounded px-2 py-1 -mx-1 transition-colors cursor-pointer"
                      onClick={() => toggleReport(report)}
                    >
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate flex-1">{report.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(report.updatedAt)}</span>
                      <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${expandedReportId === report.id ? 'rotate-90' : ''}`} />
                    </button>

                    {expandedReportId === report.id && (
                      <div className="ml-5 mt-1 pl-2 border-l border-border/40">
                        {loadingReport && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading...
                          </div>
                        )}
                        {reportContent && !loadingReport && (
                          <div className="max-h-[300px] overflow-y-auto">
                            {renderBriefMarkdown(reportContent, 40)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  {recentReports.length > 3 && !showAllReports && (
                    <button
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1 cursor-pointer"
                      onClick={() => setShowAllReports(true)}
                    >
                      <ChevronDown className="h-3 w-3" />
                      +{recentReports.length - 3} more
                    </button>
                  )}
                  <button
                    className="flex items-center gap-1.5 text-[10px] text-primary hover:underline cursor-pointer"
                    onClick={() => navigate('/artifacts?tab=reports')}
                  >
                    <ArrowRight className="h-3 w-3" />
                    View all reports
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
