import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileText, X, Loader2, RefreshCw } from 'lucide-react';

export default function ReportViewer({
  reportPath,
  onClose,
}: {
  reportPath: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = () => {
    setLoading(true);
    setError(null);
    fetch(`http://localhost:4444/api/state/artifact-content?path=${encodeURIComponent(reportPath)}`)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load: ${r.status}`);
        return r.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load content');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchContent();
  }, [reportPath]);

  return (
    <Card className="border-primary/30">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium truncate">{reportPath}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <span className="text-xs text-status-red">{error}</span>
            <button
              onClick={fetchContent}
              className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {content && (
          <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto font-mono bg-secondary/50 rounded-md p-3">
            {content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
