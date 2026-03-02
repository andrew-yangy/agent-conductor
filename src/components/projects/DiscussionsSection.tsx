import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageSquare, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ArtifactRecord } from '@/stores/types';

function DiscussionCard({ discussion }: { discussion: ArtifactRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFullContent = () => {
    if (fullContent) {
      setExpanded(!expanded);
      return;
    }
    setExpanded(true);
    setLoading(true);
    setError(null);
    fetch(`http://localhost:4444/api/state/artifact-content?path=${encodeURIComponent(discussion.filePath)}`)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load: ${r.status}`);
        return r.text();
      })
      .then(text => {
        setFullContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load');
        setLoading(false);
      });
  };

  return (
    <div
      className="rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={loadFullContent}
    >
      <div className="flex items-center gap-2 py-1.5 px-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium flex-1 truncate">{discussion.title}</span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{discussion.createdAt?.split('T')[0] ?? ''}</span>
        <ChevronRight className={cn('h-3 w-3 text-muted-foreground/50 transition-transform', expanded && 'rotate-90')} />
      </div>
      {!expanded && discussion.contentSummary && (
        <div className="text-[10px] text-muted-foreground px-2 pb-1.5 ml-6 truncate">
          {discussion.contentSummary}
        </div>
      )}
      {expanded && (
        <div className="px-2 pb-2 ml-6">
          {loading && (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px]">Loading...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 py-2">
              <span className="text-[10px] text-status-red">{error}</span>
              <button
                onClick={(e) => { e.stopPropagation(); loadFullContent(); }}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Retry
              </button>
            </div>
          )}
          {fullContent && (
            <div className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono bg-secondary/50 rounded-md p-2">
              {fullContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiscussionsSection({ discussions }: { discussions: ArtifactRecord[] }) {
  const [open, setOpen] = useState(false);

  if (discussions.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-full text-left p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Discussions</span>
              <span className="text-[10px] text-muted-foreground">{discussions.length}</span>
              <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform', open && 'rotate-90')} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-0.5 border-t border-border">
              {discussions.map(d => (
                <DiscussionCard key={d.id} discussion={d} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
