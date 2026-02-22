import { Pencil, BookOpen, Terminal, Search, GitBranch, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SessionActivity } from '@/stores/types';

interface ActivityLineProps {
  activity?: SessionActivity;
}

function getToolDisplay(activity: SessionActivity): { icon: React.ReactNode; label: string } | null {
  const { tool, detail, thinking } = activity;

  if (thinking) {
    return {
      icon: <Brain className="h-3 w-3 shrink-0" />,
      label: 'Thinking...',
    };
  }

  if (!tool) return null;

  const toolLower = tool.toLowerCase();

  if (toolLower === 'edit' || toolLower === 'write') {
    return {
      icon: <Pencil className="h-3 w-3 shrink-0" />,
      label: `Editing ${detail ?? ''}`.trim(),
    };
  }

  if (toolLower === 'read') {
    return {
      icon: <BookOpen className="h-3 w-3 shrink-0" />,
      label: `Reading ${detail ?? ''}`.trim(),
    };
  }

  if (toolLower === 'bash') {
    return {
      icon: <Terminal className="h-3 w-3 shrink-0" />,
      label: `Running: ${detail ?? ''}`.trim(),
    };
  }

  if (toolLower === 'grep') {
    return {
      icon: <Search className="h-3 w-3 shrink-0" />,
      label: `Searching: ${detail ?? ''}`.trim(),
    };
  }

  if (toolLower === 'task') {
    return {
      icon: <GitBranch className="h-3 w-3 shrink-0" />,
      label: 'Spawned agent',
    };
  }

  return null;
}

export default function ActivityLine({ activity }: ActivityLineProps) {
  if (!activity || !activity.active) return null;

  const display = getToolDisplay(activity);
  if (!display) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
      <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
      {display.icon}
      <span className="truncate">{display.label}</span>
      {activity.model && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
          {activity.model.replace('claude-', '').replace('-4-6', '')}
        </Badge>
      )}
    </div>
  );
}
