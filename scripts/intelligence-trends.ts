#!/usr/bin/env tsx
/**
 * Intelligence Trends & Cross-Scout Pattern Detection
 *
 * Reads scout intelligence data and computes:
 * 1. Acceptance rates per agent and per topic
 * 2. Trending themes across scout runs
 * 3. Cross-scout patterns (topics mentioned by multiple agents)
 *
 * Can be run standalone or imported by the server.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntelligenceItem {
  id: string;
  type: string;
  urgency: string;
  title: string;
  source?: string;
  detail?: string;
  relevance?: string;
  products_affected?: string[];
  recommended_action?: string;
  reported_by?: string[];
  cross_references?: string[];
}

export interface ScoutOutput {
  agent: string;
  domain: string;
  scout_date: string;
  intelligence: IntelligenceItem[];
  proposed_initiatives?: Array<{
    title: string;
    priority: string;
    risk: string;
    related_intelligence?: string[];
  }>;
  summary: string;
}

export interface ProposalLogEntry {
  status: 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'PROMOTED';
  title: string;
  proposedBy: string[];
  priority: string;
  risk: string;
  source: string;
  ceoReason?: string;
}

export interface AgentStats {
  agent: string;
  domain: string;
  totalFindings: number;
  findingsByUrgency: Record<string, number>;
  findingsByType: Record<string, number>;
  proposalsSubmitted: number;
  proposalsAccepted: number;
  acceptanceRate: number;
  topProducts: string[];
}

export interface TopicCluster {
  topic: string;
  keywords: string[];
  mentionCount: number;
  agents: string[];
  urgencyMax: string;
  items: Array<{ id: string; title: string; agent: string; urgency: string }>;
}

export interface CrossScoutSignal {
  topic: string;
  agentCount: number;
  agents: string[];
  totalMentions: number;
  highestUrgency: string;
  items: Array<{ id: string; title: string; agent: string; urgency: string }>;
  strength: 'strong' | 'moderate' | 'weak';
  shouldPromote: boolean;
}

export interface IntelligenceTrendsResult {
  generated: string;
  scoutDate: string | null;
  totalFindings: number;
  totalProposals: number;
  totalAccepted: number;
  overallAcceptanceRate: number;
  agentStats: AgentStats[];
  topTopics: TopicCluster[];
  crossScoutSignals: CrossScoutSignal[];
  urgencyBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  productHeatmap: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Keyword extraction — simple but effective for structured intelligence
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'not', 'no', 'nor', 'so',
  'if', 'then', 'than', 'that', 'this', 'these', 'those', 'it', 'its',
  'our', 'we', 'us', 'they', 'them', 'their', 'you', 'your', 'all',
  'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'only', 'into', 'over', 'after', 'before', 'about', 'up', 'out',
  'new', 'now', 'also', 'just', 'via', 'still', 'yet', 'already',
]);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Also extract bigrams for compound terms
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  return [...new Set([...words, ...bigrams])];
}

// Known topic clusters — domain-specific groupings
const TOPIC_CLUSTERS: Record<string, string[]> = {
  'security': ['cve', 'vulnerability', 'advisory', 'security', 'exploit', ' rce ', 'dos attack', 'patch', 'disclosure', 'cvss'],
  'nextjs': ['nextjs', 'next-js', 'next.js', 'turbopack', 'react server', 'rsc', 'server components'],
  'prisma': ['prisma', 'orm migration'],
  'aws-lambda': ['lambda', 'cold start', 'serverless', 'aws lambda', 'init phase'],
  'elasticsearch': ['elasticsearch', 'elastic search', 'lz4', 'esa-'],
  'agent-frameworks': ['crewai', 'autogen', 'langgraph', 'metagpt', 'agent framework', 'orchestration', 'a2a protocol'],
  'competitor-monitoring': ['competitor', 'monitoring', 'price tracking', 'prisync', 'price2spy', 'competera', 'repricing'],
  'au-ecommerce': ['australia', 'australian', 'au market', 'temu', 'amazon au', 'ozbargain'],
  'geo-seo': ['geo ', 'seo', 'citation', 'ai search', 'schema markup', 'structured data'],
  'api-economy': ['pricing api', 'pricesapi', 'data api', 'rapidapi', 'api economy'],
  'claude-code': ['claude code', 'anthropic', 'worktree', '/batch'],
  'ai-tools': ['ai code review', 'coderabbit', 'cursor bugbot', 'copilot', 'ai-powered'],
};

// Pre-compile word-boundary-aware regex for each keyword
const TOPIC_REGEXES = new Map<string, Array<{ keyword: string; regex: RegExp }>>();
for (const [topic, keywords] of Object.entries(TOPIC_CLUSTERS)) {
  TOPIC_REGEXES.set(
    topic,
    keywords.map((kw) => ({
      keyword: kw,
      regex: new RegExp(`(?:^|[\\s\\-_/,(])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s\\-_/,.)!?;:]|$)`, 'i'),
    }))
  );
}

function classifyTopic(item: IntelligenceItem): string[] {
  const text = ` ${item.title} ${item.detail ?? ''} ${item.id} `.toLowerCase();
  const matched: string[] = [];

  for (const [topic, patterns] of TOPIC_REGEXES) {
    if (patterns.some((p) => p.regex.test(text))) {
      matched.push(topic);
    }
  }

  return matched.length > 0 ? matched : ['other'];
}

// ---------------------------------------------------------------------------
// Urgency ordering for comparisons
// ---------------------------------------------------------------------------

const URGENCY_ORDER: Record<string, number> = {
  act_now: 4,
  this_week: 3,
  this_month: 2,
  fyi: 1,
};

function maxUrgency(a: string, b: string): string {
  return (URGENCY_ORDER[a] ?? 0) >= (URGENCY_ORDER[b] ?? 0) ? a : b;
}

// ---------------------------------------------------------------------------
// Parse proposals.log
// ---------------------------------------------------------------------------

function parseProposalsLog(logPath: string): ProposalLogEntry[] {
  if (!fs.existsSync(logPath)) return [];

  const raw = fs.readFileSync(logPath, 'utf-8');
  const entries: ProposalLogEntry[] = [];
  const lines = raw.split('\n');

  let current: Partial<ProposalLogEntry> | null = null;

  for (const line of lines) {
    const statusMatch = line.match(/^\[(APPROVED|REJECTED|DEFERRED|PROMOTED)]\s+(.+)$/);
    if (statusMatch) {
      if (current?.status && current?.title) {
        entries.push(current as ProposalLogEntry);
      }
      current = {
        status: statusMatch[1] as ProposalLogEntry['status'],
        title: statusMatch[2].trim(),
        proposedBy: [],
        priority: '',
        risk: '',
        source: '',
      };
      continue;
    }

    if (!current) continue;

    const proposedMatch = line.match(/^\s+Proposed by:\s+(.+)$/);
    if (proposedMatch) {
      current.proposedBy = proposedMatch[1].split(',').map((s) => s.trim());
    }

    const priorityMatch = line.match(/^\s+Priority:\s+(.+)$/);
    if (priorityMatch) {
      current.priority = priorityMatch[1].trim();
    }

    const riskMatch = line.match(/^\s+Risk:\s+(.+)$/);
    if (riskMatch) {
      current.risk = riskMatch[1].trim();
    }

    const sourceMatch = line.match(/^\s+Source:\s+(.+)$/);
    if (sourceMatch) {
      current.source = sourceMatch[1].trim();
    }

    const reasonMatch = line.match(/^\s+CEO reason:\s+(.+)$/);
    if (reasonMatch) {
      current.ceoReason = reasonMatch[1].trim();
    }
  }

  // Push last entry
  if (current?.status && current?.title) {
    entries.push(current as ProposalLogEntry);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

export function analyzeIntelligence(projectPaths: string[]): IntelligenceTrendsResult {
  const allScoutOutputs: ScoutOutput[] = [];
  let proposalEntries: ProposalLogEntry[] = [];

  // Gather intelligence from all configured project paths
  for (const projectPath of projectPaths) {
    const intelDir = path.join(projectPath, '.context', 'intel');
    const latestDir = path.join(intelDir, 'latest');

    if (fs.existsSync(latestDir)) {
      const files = fs.readdirSync(latestDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(latestDir, file), 'utf-8');
          const parsed = JSON.parse(raw) as ScoutOutput;
          if (parsed.agent && parsed.intelligence) {
            allScoutOutputs.push(parsed);
          }
        } catch {
          // Skip malformed files
        }
      }
    }

    // Also check archive for historical data
    const archiveDir = path.join(intelDir, 'archive');
    if (fs.existsSync(archiveDir)) {
      const dateDirs = fs.readdirSync(archiveDir).filter((d) => {
        return fs.statSync(path.join(archiveDir, d)).isDirectory();
      });
      for (const dateDir of dateDirs) {
        const archFiles = fs.readdirSync(path.join(archiveDir, dateDir)).filter((f) => f.endsWith('.json'));
        for (const file of archFiles) {
          try {
            const raw = fs.readFileSync(path.join(archiveDir, dateDir, file), 'utf-8');
            const parsed = JSON.parse(raw) as ScoutOutput;
            if (parsed.agent && parsed.intelligence) {
              allScoutOutputs.push(parsed);
            }
          } catch {
            // Skip malformed
          }
        }
      }
    }

    // Read proposals log
    // proposals.log may live in .context/ or in intel/
    const proposalsPath = path.join(projectPath, '.context', 'intel', 'proposals.log');
    const parsed = parseProposalsLog(proposalsPath);
    proposalEntries = [...proposalEntries, ...parsed];
  }

  // Build per-agent stats
  const agentMap = new Map<string, AgentStats>();
  let scoutDate: string | null = null;

  for (const scout of allScoutOutputs) {
    if (!scoutDate) scoutDate = scout.scout_date;

    if (!agentMap.has(scout.agent)) {
      agentMap.set(scout.agent, {
        agent: scout.agent,
        domain: scout.domain,
        totalFindings: 0,
        findingsByUrgency: {},
        findingsByType: {},
        proposalsSubmitted: 0,
        proposalsAccepted: 0,
        acceptanceRate: 0,
        topProducts: [],
      });
    }

    const stats = agentMap.get(scout.agent)!;
    stats.totalFindings += scout.intelligence.length;

    const productCounts: Record<string, number> = {};

    for (const item of scout.intelligence) {
      stats.findingsByUrgency[item.urgency] = (stats.findingsByUrgency[item.urgency] ?? 0) + 1;
      stats.findingsByType[item.type] = (stats.findingsByType[item.type] ?? 0) + 1;

      for (const product of item.products_affected ?? []) {
        productCounts[product] = (productCounts[product] ?? 0) + 1;
      }
    }

    stats.topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([p]) => p);

    if (scout.proposed_initiatives) {
      stats.proposalsSubmitted += scout.proposed_initiatives.length;
    }
  }

  // Match proposals to agents using proposals.log
  for (const entry of proposalEntries) {
    for (const agentName of entry.proposedBy) {
      const normalized = agentName.toLowerCase();
      const stats = agentMap.get(normalized);
      if (stats && entry.status === 'APPROVED') {
        stats.proposalsAccepted++;
      }
    }
  }

  // Compute acceptance rates
  for (const stats of agentMap.values()) {
    stats.acceptanceRate = stats.proposalsSubmitted > 0
      ? Math.round((stats.proposalsAccepted / stats.proposalsSubmitted) * 100)
      : 0;
  }

  // Build topic clusters from all intelligence
  const topicMap = new Map<string, TopicCluster>();

  for (const scout of allScoutOutputs) {
    for (const item of scout.intelligence) {
      const topics = classifyTopic(item);

      for (const topic of topics) {
        if (!topicMap.has(topic)) {
          topicMap.set(topic, {
            topic,
            keywords: [],
            mentionCount: 0,
            agents: [],
            urgencyMax: 'fyi',
            items: [],
          });
        }

        const cluster = topicMap.get(topic)!;
        cluster.mentionCount++;
        cluster.urgencyMax = maxUrgency(cluster.urgencyMax, item.urgency);

        if (!cluster.agents.includes(scout.agent)) {
          cluster.agents.push(scout.agent);
        }

        cluster.items.push({
          id: item.id,
          title: item.title,
          agent: scout.agent,
          urgency: item.urgency,
        });

        // Add keywords
        const kw = extractKeywords(item.title);
        for (const k of kw) {
          if (!cluster.keywords.includes(k)) {
            cluster.keywords.push(k);
          }
        }
      }
    }
  }

  // Cross-scout pattern detection: topics with 2+ agents
  const crossScoutSignals: CrossScoutSignal[] = [];

  for (const cluster of topicMap.values()) {
    if (cluster.agents.length >= 2) {
      const strength: CrossScoutSignal['strength'] =
        cluster.agents.length >= 3 ? 'strong' :
        cluster.mentionCount >= 4 ? 'strong' :
        cluster.agents.length >= 2 && cluster.mentionCount >= 3 ? 'moderate' :
        'weak';

      // Auto-promote if strong signal + high urgency
      const shouldPromote = strength !== 'weak' &&
        (cluster.urgencyMax === 'act_now' || cluster.urgencyMax === 'this_week');

      crossScoutSignals.push({
        topic: cluster.topic,
        agentCount: cluster.agents.length,
        agents: cluster.agents,
        totalMentions: cluster.mentionCount,
        highestUrgency: cluster.urgencyMax,
        items: cluster.items,
        strength,
        shouldPromote,
      });
    }
  }

  // Sort cross-scout signals by strength then urgency
  crossScoutSignals.sort((a, b) => {
    const strengthOrder: Record<string, number> = { strong: 3, moderate: 2, weak: 1 };
    const sDiff = (strengthOrder[b.strength] ?? 0) - (strengthOrder[a.strength] ?? 0);
    if (sDiff !== 0) return sDiff;
    return (URGENCY_ORDER[b.highestUrgency] ?? 0) - (URGENCY_ORDER[a.highestUrgency] ?? 0);
  });

  // Global aggregates
  const urgencyBreakdown: Record<string, number> = {};
  const typeBreakdown: Record<string, number> = {};
  const productHeatmap: Record<string, number> = {};
  let totalFindings = 0;

  for (const scout of allScoutOutputs) {
    for (const item of scout.intelligence) {
      totalFindings++;
      urgencyBreakdown[item.urgency] = (urgencyBreakdown[item.urgency] ?? 0) + 1;
      typeBreakdown[item.type] = (typeBreakdown[item.type] ?? 0) + 1;
      for (const product of item.products_affected ?? []) {
        productHeatmap[product] = (productHeatmap[product] ?? 0) + 1;
      }
    }
  }

  const totalProposals = proposalEntries.filter((e) => e.status !== 'PROMOTED').length;
  const totalAccepted = proposalEntries.filter((e) => e.status === 'APPROVED').length;

  const topTopics = Array.from(topicMap.values())
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 10);

  return {
    generated: new Date().toISOString(),
    scoutDate,
    totalFindings,
    totalProposals,
    totalAccepted,
    overallAcceptanceRate: totalProposals > 0 ? Math.round((totalAccepted / totalProposals) * 100) : 0,
    agentStats: Array.from(agentMap.values()),
    topTopics,
    crossScoutSignals,
    urgencyBreakdown,
    typeBreakdown,
    productHeatmap,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (process.argv[1] && process.argv[1].endsWith('intelligence-trends.ts')) {
  const projectPaths = process.argv.slice(2);
  if (projectPaths.length === 0) {
    console.error('Usage: tsx intelligence-trends.ts <project-path> [project-path...]');
    console.error('Example: tsx intelligence-trends.ts /Users/yangyang/Repos/sw');
    process.exit(1);
  }

  const result = analyzeIntelligence(projectPaths);
  console.log(JSON.stringify(result, null, 2));
}
