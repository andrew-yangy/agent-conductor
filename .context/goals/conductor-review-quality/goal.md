# Conductor Review Quality

## Objective
Ensure the conductor's review pipeline catches real issues — not just "does the code compile" but "does this do what the CEO actually meant." The review system should be the CEO's last line of defense against work that technically passes but misses the point.

## Why This Exists
A CEO correction to separate Agent Conductor from Platform was marked "DONE" after repo separation, but the dashboard UI still grouped them together. The review step signed off on it. This exposed systemic gaps: no acceptance criteria, no corrections cross-referencing, advisory-only visual verification, and abstract review criteria.

## Success Criteria
- Reviews catch CEO-intent violations, not just code bugs
- Standing corrections are enforced automatically (not buried in memory)
- UI work gets browser-tested as a blocking gate
- Reviewers are matched to the domain being reviewed (not Sarah-for-everything)
- DOD makes "done" concrete and verifiable
