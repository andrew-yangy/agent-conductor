# Team & Agent Org Dashboard

As CEO, I want to treat the dashboard UI as the main tool for my work. I need to navigate from a **team and agents perspective** (people-first view).

## Requirements

### Org Structure View
- Show the organizational hierarchy: CEO → C-suite (Sarah CTO, Marcus CPO, Priya CMO, Morgan COO, Alex CoS) → Engineers
- Visualize the relationships and reporting structure
- Make it navigable — click into each person to see their details

### Agent Status
- Show real-time status for each agent: **working**, **idle**, etc.
- Show what each agent is currently working on (if active)
- Visual indicators (color-coded or icons) for status at a glance

### Agent Detail View
- Latest work: recent sessions, tasks completed
- Logs: relevant session logs and output
- Discussions: any clarification threads, Q&A
- Reports: reviews, audits, digests they've contributed to
- As much information as possible about each agent's activity and history

### Navigation
- This should be a first-class navigation item (sidebar entry)
- The team/org view should feel like the primary way to understand what's happening
- Quick access from the dashboard overview as well

## Success Criteria
- CEO can open the dashboard and immediately see who's working and who's idle
- CEO can click into any agent and see their full activity history
- The org hierarchy is visually clear and interactive
- Status updates are real-time (or near real-time via WebSocket)
