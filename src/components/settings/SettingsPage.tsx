import { useState } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE = 'http://localhost:4444';

export default function SettingsPage() {
  const notificationConfig = useDashboardStore((s) => s.notificationConfig);
  const updateNotificationConfig = useDashboardStore((s) => s.updateNotificationConfig);

  const [macOS, setMacOS] = useState(notificationConfig.macOS);
  const [browser, setBrowser] = useState(notificationConfig.browser);

  async function patchConfig(updates: { macOS?: boolean; browser?: boolean }) {
    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: updates }),
      });
      if (res.ok) {
        const data = await res.json() as { ok: boolean; notifications: { macOS: boolean; browser: boolean } };
        updateNotificationConfig(data.notifications);
      }
    } catch {
      // Network error — local state already updated optimistically
    }
  }

  function handleMacOSChange(checked: boolean) {
    setMacOS(checked);
    void patchConfig({ macOS: checked });
  }

  function handleBrowserChange(checked: boolean) {
    setBrowser(checked);
    void patchConfig({ browser: checked });
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure Conductor preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* macOS notifications */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-foreground">macOS notifications</span>
              <p className="text-xs text-muted-foreground">Native macOS alerts via osascript</p>
            </div>
            <Switch
              checked={macOS}
              onCheckedChange={handleMacOSChange}
              aria-label="Toggle macOS notifications"
            />
          </div>

          <div className="h-px bg-border" />

          {/* Browser notifications */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-foreground">Browser notifications</span>
              <p className="text-xs text-muted-foreground">Web push notifications when tab is open</p>
            </div>
            <Switch
              checked={browser}
              onCheckedChange={handleBrowserChange}
              aria-label="Toggle browser notifications"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
