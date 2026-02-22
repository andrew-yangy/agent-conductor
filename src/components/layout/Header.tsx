import { useLocation } from 'react-router-dom';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/stores/dashboard-store';
import { timeAgo } from '@/lib/utils';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/sessions': 'Sessions',
  '/activity': 'Activity',
};

export default function Header() {
  const location = useLocation();
  const { connected, lastUpdated } = useDashboardStore();
  const notificationsGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';

  // Get title — handle dynamic routes
  let title = PAGE_TITLES[location.pathname] ?? '';
  if (location.pathname.startsWith('/teams/')) {
    const teamName = decodeURIComponent(location.pathname.split('/teams/')[1]);
    title = teamName;
  }

  const handleNotificationToggle = async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-status-green' : 'bg-status-red'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Updated {timeAgo(lastUpdated)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleNotificationToggle}
          title={notificationsGranted ? 'Notifications enabled' : 'Enable notifications'}
        >
          {notificationsGranted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
