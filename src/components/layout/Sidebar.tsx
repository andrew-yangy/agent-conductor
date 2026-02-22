import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Monitor, Activity, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useDashboardStore } from '@/stores/dashboard-store';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/sessions', icon: Monitor, label: 'Sessions' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const connected = useDashboardStore((s) => s.connected);
  const location = useLocation();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-sidebar h-screen transition-all duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center h-14 px-4', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground tracking-tight">Conductor</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4" />
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3">
          <Separator className="mb-3" />
          <div className={cn('flex items-center gap-2', collapsed ? 'justify-center' : '')}>
            <div
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                connected ? 'bg-status-green animate-pulse' : 'bg-status-red'
              )}
            />
            {!collapsed && (
              <span className="text-xs text-muted-foreground">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
