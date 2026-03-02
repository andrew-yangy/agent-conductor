import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDashboardStore } from '@/stores/dashboard-store';
import type { ArtifactRecord, ConductorState } from '@/stores/types';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import {
  FileText,
  MessageSquare,
  BookOpen,
  ChevronRight,
  Archive,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Simple markdown renderer (headings, bold, lists, code blocks)
// ---------------------------------------------------------------------------

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={key++} className="bg-secondary/80 rounded px-3 py-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap my-2">
            {codeLines.join('\n')}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Skip the title (first # heading) — it's already shown as the card title
    if (line.startsWith('# ') && key === 0 && elements.length === 0) {
      key++;
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={key++} className="text-xs font-semibold text-foreground mt-3 mb-1">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h4 key={key++} className="text-xs font-medium text-foreground mt-2 mb-0.5">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={key++} className="text-xs text-muted-foreground leading-relaxed pl-3 flex gap-1.5">
          <span className="shrink-0">·</span>
          <span>{renderInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (line.startsWith('|') && line.endsWith('|')) {
      // Table row — render as simple text
      elements.push(
        <div key={key++} className="text-[10px] text-muted-foreground font-mono leading-relaxed">
          {line}
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1" />);
    } else {
      elements.push(
        <p key={key++} className="text-xs text-muted-foreground leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    }
  }

  return elements;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-foreground font-medium">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Artifact card with full content loading
// ---------------------------------------------------------------------------

function ArtifactCard({ artifact, initialOpen = false, highlighted = false }: {
  artifact: ArtifactRecord;
  initialOpen?: boolean;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialOpen);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll into view if highlighted
  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  // Load full content when expanded
  const loadContent = useCallback(() => {
    if (content || loadingContent || !artifact.filePath) return;
    setLoadingContent(true);
    fetch(`http://localhost:4444/api/state/artifact-content?path=${encodeURIComponent(artifact.filePath)}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.text();
      })
      .then(text => setContent(text))
      .catch(() => setContent(null))
      .finally(() => setLoadingContent(false));
  }, [artifact.filePath, content, loadingContent]);

  useEffect(() => {
    if (expanded) loadContent();
  }, [expanded, loadContent]);

  const icon = artifact.type === 'report'
    ? <FileText className="h-4 w-4 text-status-green shrink-0" />
    : artifact.type === 'discussion'
    ? <MessageSquare className="h-4 w-4 text-status-blue shrink-0" />
    : <BookOpen className="h-4 w-4 text-primary shrink-0" />;

  return (
    <Card ref={cardRef} className={cn(highlighted && 'ring-1 ring-primary/50')}>
      <CardContent className="p-0">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className="w-full text-left p-4">
            <div className="flex items-center gap-3">
              {icon}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{artifact.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(artifact.updatedAt)}
                  </span>
                  {artifact.sourceDirective && (
                    <>
                      <span className="text-[10px] text-border">|</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {artifact.sourceDirective}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {artifact.type}
                </Badge>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    expanded && "rotate-90"
                  )}
                />
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0 border-t border-border">
              <div className="mt-3">
                {loadingContent && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading content...
                  </div>
                )}
                {content && (
                  <div className="max-h-[500px] overflow-y-auto pr-2">
                    {renderMarkdown(content)}
                  </div>
                )}
                {!loadingContent && !content && artifact.contentSummary && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {artifact.contentSummary}
                  </p>
                )}
                {artifact.participants && artifact.participants.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-muted-foreground">Participants:</span>
                    <div className="flex flex-wrap gap-1">
                      {artifact.participants.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground font-mono bg-secondary/50 px-2 py-1 rounded mt-2">
                  {artifact.filePath}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Artifact list
// ---------------------------------------------------------------------------

function ArtifactList({ artifacts, highlightId }: { artifacts: ArtifactRecord[]; highlightId?: string }) {
  if (artifacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Archive className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No artifacts found.</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by most recent
  const sorted = [...artifacts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="space-y-2">
      {sorted.map(artifact => (
        <ArtifactCard
          key={artifact.id}
          artifact={artifact}
          initialOpen={artifact.id === highlightId}
          highlighted={artifact.id === highlightId}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ArtifactsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-10 w-64" />
      {[1, 2, 3].map(i => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ArtifactsPage() {
  const workState = useDashboardStore((s) => s.workState);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') ?? 'reports';
  const highlightId = searchParams.get('highlight') ?? undefined;

  // Fetch conductor state if not loaded
  useEffect(() => {
    if (workState?.conductor) return;
    setLoading(true);
    fetch('http://localhost:4444/api/state/conductor')
      .then(r => r.json())
      .then((conductor: ConductorState | null) => {
        if (conductor) {
          const current = useDashboardStore.getState().workState;
          useDashboardStore.getState().setWorkState({
            goals: current?.goals ?? null,
            features: current?.features ?? null,
            backlogs: current?.backlogs ?? null,
            conductor,
            index: current?.index ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workState]);

  const conductor = workState?.conductor;

  const { reports, discussions, research } = useMemo(() => ({
    reports: conductor?.reports ?? [],
    discussions: conductor?.discussions ?? [],
    research: conductor?.research ?? [],
  }), [conductor]);

  if (loading) {
    return <ArtifactsSkeleton />;
  }

  const totalCount = reports.length + discussions.length + research.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Artifacts</h1>
        <div className="text-xs text-muted-foreground">
          {totalCount} total artifacts
        </div>
      </div>

      <Tabs defaultValue={tabParam} className="w-full">
        <TabsList>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Reports
            {reports.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{reports.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="discussions" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Discussions
            {discussions.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{discussions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Research
            {research.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{research.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4">
          <ArtifactList artifacts={reports} highlightId={highlightId} />
        </TabsContent>

        <TabsContent value="discussions" className="mt-4">
          <ArtifactList artifacts={discussions} highlightId={highlightId} />
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          <ArtifactList artifacts={research} highlightId={highlightId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
