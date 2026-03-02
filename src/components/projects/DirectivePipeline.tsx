import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ArrowRightLeft,
  CheckCircle2,
  FileText,
  Lightbulb,
  ClipboardList,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { DirectiveRecord } from '@/stores/types';

// ---------------------------------------------------------------------------
// Weight badge
// ---------------------------------------------------------------------------

function weightBadge(weight?: string) {
  if (!weight) return null;
  const colors: Record<string, string> = {
    lightweight: 'bg-status-green/15 text-status-green border-status-green/30',
    medium: 'bg-status-yellow/15 text-status-yellow border-status-yellow/30',
    heavyweight: 'bg-primary/15 text-primary border-primary/30',
    strategic: 'bg-status-red/15 text-status-red border-status-red/30',
  };
  return (
    <Badge variant="outline" className={cn('text-[9px] px-1 py-0', colors[weight] ?? 'bg-secondary text-muted-foreground border-border')}>
      {weight}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Directive Card (for both pending and done)
// ---------------------------------------------------------------------------

function DirectiveCard({
  directive,
  onReportClick,
}: {
  directive: DirectiveRecord;
  onReportClick?: (reportPath: string) => void;
}) {
  const isPending = directive.status !== 'done';
  const hasReport = !!(directive.report || directive.reportPath);
  const goalIds = directive.goalIds ?? [];
  const producedFeatures = directive.producedFeatures ?? [];

  return (
    <div className="flex items-start gap-2 py-2 px-3 rounded-md hover:bg-accent/50 transition-colors">
      {isPending ? (
        <ArrowRightLeft className="h-3.5 w-3.5 text-status-yellow shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 text-status-green shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-medium', !isPending && 'text-muted-foreground')}>{directive.title}</span>
          {weightBadge(directive.weight)}
          {hasReport && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const path = directive.report || directive.reportPath;
                if (path && onReportClick) onReportClick(path);
              }}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <FileText className="h-2.5 w-2.5" />
              Report
            </button>
          )}
        </div>
        {goalIds.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {goalIds.map(gid => (
              <span key={gid} className="text-[9px] text-muted-foreground bg-secondary px-1 py-0 rounded">
                {gid}
              </span>
            ))}
          </div>
        )}
        {producedFeatures.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {producedFeatures.map(f => (
              <Badge key={f} variant="outline" className="text-[9px] px-1 py-0 border-status-green/30 text-status-green">
                {f}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {directive.artifacts && directive.artifacts.length > 0 && (
        <div className="flex items-center gap-0.5 shrink-0">
          {directive.artifacts.map(a => {
            const Icon = a.includes('brainstorm') ? Lightbulb
              : a.includes('plan') ? ClipboardList
              : FileText;
            return <Icon key={a} className="h-3 w-3 text-muted-foreground/60" title={a} />;
          })}
        </div>
      )}
      <span className="text-[10px] text-muted-foreground/60 shrink-0">
        {directive.createdAt?.split('T')[0] ?? ''}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Directive Pipeline Section
// ---------------------------------------------------------------------------

export default function DirectivePipeline({
  directives,
  onReportClick,
}: {
  directives: DirectiveRecord[];
  onReportClick?: (reportPath: string) => void;
}) {
  const pending = directives.filter(d => d.status !== 'done');
  const done = [...directives.filter(d => d.status === 'done')].sort(
    (a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  );
  const [showDone, setShowDone] = useState(false);

  if (directives.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Directive Pipeline</span>
          {pending.length > 0 && (
            <Badge variant="outline" className="bg-status-yellow/15 text-status-yellow border-status-yellow/30 text-[10px] px-1.5 py-0">
              {pending.length} pending
            </Badge>
          )}
          <Badge variant="outline" className="bg-status-green/15 text-status-green border-status-green/30 text-[10px] px-1.5 py-0">
            {done.length} done
          </Badge>
        </div>

        {/* Pending directives */}
        {pending.length > 0 && (
          <div className="space-y-0.5 mb-2">
            {pending.map(d => (
              <DirectiveCard key={d.id} directive={d} onReportClick={onReportClick} />
            ))}
          </div>
        )}

        {/* Done directives — collapsible */}
        {done.length > 0 && (
          <Collapsible open={showDone} onOpenChange={setShowDone}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium px-2 hover:text-foreground transition-colors cursor-pointer w-full text-left">
              <ChevronRight className={cn('h-3 w-3 transition-transform', showDone && 'rotate-90')} />
              Completed ({done.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 mt-1">
                {done.map(d => (
                  <DirectiveCard key={d.id} directive={d} onReportClick={onReportClick} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
