import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PlanEntry } from '@/stores/types';
import { useDashboardStore } from '@/stores/dashboard-store';

interface PlanViewerProps {
  plans: PlanEntry[];
}

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderMarkdown(md: string): string {
  return md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted rounded p-3 my-2 text-xs overflow-x-auto"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted rounded px-1 py-0.5 text-xs">$1</code>')
    // H1
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-4 mb-2">$1</h1>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-3 mb-1.5">$1</h2>')
    // H3
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-2 mb-1">$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>')
    // Tables (basic)
    .replace(/\|(.+)\|/g, (match) => {
      if (match.match(/^\|[\s-|]+\|$/)) return ''; // separator row
      const cells = match.split('|').filter(Boolean).map((c) => c.trim());
      return `<div class="flex gap-4 text-xs py-0.5">${cells.map((c) => `<span class="flex-1">${c}</span>`).join('')}</div>`;
    })
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="text-sm leading-relaxed mb-2">')
    // Single newlines
    .replace(/\n/g, '<br/>');
}

export default function PlanViewer({ plans }: PlanViewerProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(plans[0]?.slug ?? null);
  const sessions = useDashboardStore((s) => s.sessions);

  const runningSlugs = new Set(
    sessions
      .filter((s) => s.slug && ['working', 'waiting-approval', 'waiting-input'].includes(s.status))
      .map((s) => s.slug!)
  );
  const doneSlugs = new Set(
    sessions
      .filter((s) => s.slug && !['working', 'waiting-approval', 'waiting-input'].includes(s.status))
      .map((s) => s.slug!)
  );

  const selectedPlan = plans.find((p) => p.slug === selectedSlug);

  if (plans.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-8 text-center">
        No plans found in ~/.claude/plans/
      </div>
    );
  }

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Left sidebar — plan list */}
      <div className="w-64 shrink-0 overflow-auto border border-border rounded-md">
        {plans.map((plan) => (
          <button
            key={plan.slug}
            onClick={() => setSelectedSlug(plan.slug)}
            className={cn(
              'w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors',
              'hover:bg-accent/50',
              selectedSlug === plan.slug && 'bg-accent text-accent-foreground'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium leading-tight line-clamp-2">
                {plan.title.replace(/^Plan:\s*/i, '')}
              </span>
              {runningSlugs.has(plan.slug) && (
                <Badge variant="default" className="text-[9px] px-1 py-0 shrink-0 bg-status-green">
                  running
                </Badge>
              )}
              {!runningSlugs.has(plan.slug) && doneSlugs.has(plan.slug) && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                  done
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{timeAgoShort(plan.modifiedAt)}</span>
          </button>
        ))}
      </div>

      {/* Right panel — rendered markdown */}
      <Card className="flex-1 overflow-auto">
        <CardContent className="p-6">
          {selectedPlan ? (
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedPlan.content) }}
            />
          ) : (
            <div className="text-muted-foreground text-sm">Select a plan to view</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
