import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const MAX_CHARS = 500;

interface SendInputProps {
  paneId: string;
}

export default function SendInput({ paneId }: SendInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleConfirmSend() {
    if (!inputValue.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch('http://localhost:4444/api/actions/send-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paneId, type: 'text', input: inputValue }),
      });
      if (response.ok) {
        setInputValue('');
        setDialogOpen(false);
        setExpanded(false);
      }
    } catch {
      // Silent fail — user can retry
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Send input
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, MAX_CHARS))}
              maxLength={MAX_CHARS}
              placeholder="Type input to send to agent terminal…"
              className="h-8 text-xs pr-14"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  setDialogOpen(true);
                }
              }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
              {inputValue.length}/{MAX_CHARS}
            </span>
          </div>

          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => {
              if (inputValue.trim()) setDialogOpen(true);
            }}
            disabled={!inputValue.trim()}
          >
            Send
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send input to terminal</DialogTitle>
            <DialogDescription>
              This will type the following into the agent's terminal:
            </DialogDescription>
          </DialogHeader>

          <pre className="mt-2 rounded-md bg-secondary/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all border border-border">
            <code>{inputValue}</code>
          </pre>

          <DialogFooter className="mt-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSend}
              disabled={sending}
            >
              {sending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
