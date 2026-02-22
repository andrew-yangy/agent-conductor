import { useState } from 'react';
import { Check, X, Ban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Session } from '@/stores/types';

interface QuickActionsProps {
  paneId: string;
  sessionStatus: Session['status'];
  onAction?: () => void;
}

type ActionType = 'approve' | 'reject' | 'abort';

async function sendAction(paneId: string, type: ActionType): Promise<void> {
  const response = await fetch('http://localhost:4444/api/actions/send-input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paneId, type, input: '' }),
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

export default function QuickActions({ paneId, sessionStatus, onAction }: QuickActionsProps) {
  const [loading, setLoading] = useState<ActionType | null>(null);

  if (sessionStatus !== 'waiting-input' && sessionStatus !== 'waiting-approval') {
    return null;
  }

  async function handleAction(type: ActionType) {
    if (loading) return;
    setLoading(type);
    try {
      await sendAction(paneId, type);
      onAction?.();
    } catch {
      // Silent fail — terminal state will reflect the result
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        className={cn(
          'h-7 px-2 text-xs flex-1',
          'text-green-500 border-green-500/30 hover:bg-green-500/10 hover:text-green-500'
        )}
        onClick={() => handleAction('approve')}
        disabled={loading !== null}
      >
        {loading === 'approve' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        <span className="ml-1">Approve</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        className={cn(
          'h-7 px-2 text-xs flex-1',
          'text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-500'
        )}
        onClick={() => handleAction('reject')}
        disabled={loading !== null}
      >
        {loading === 'reject' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
        <span className="ml-1">Reject</span>
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs flex-1 text-muted-foreground"
        onClick={() => handleAction('abort')}
        disabled={loading !== null}
      >
        {loading === 'abort' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Ban className="h-3 w-3" />
        )}
        <span className="ml-1">Abort</span>
      </Button>
    </div>
  );
}
