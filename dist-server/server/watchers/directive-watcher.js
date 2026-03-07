import path from 'node:path';
import fs from 'node:fs';
import { watch } from 'chokidar';
import { directivesDir as resolveDirectivesDir } from '../paths.js';
// Pipeline steps by weight class. Steps not in a weight's list are skipped.
const FULL_PIPELINE_STEPS = [
    { id: 'triage', label: 'Triage' },
    { id: 'read', label: 'Read' },
    { id: 'context', label: 'Context' },
    { id: 'challenge', label: 'Challenge' },
    { id: 'brainstorm', label: 'Brainstorm' },
    { id: 'plan', label: 'Plan' },
    { id: 'audit', label: 'Audit' },
    { id: 'approve', label: 'Approve' },
    { id: 'project-brainstorm', label: 'Project Brainstorm' },
    { id: 'setup', label: 'Setup' },
    { id: 'execute', label: 'Execute' },
    { id: 'review-gate', label: 'Review Gate' },
    { id: 'wrapup', label: 'Wrapup' },
    { id: 'completion', label: 'Completion' },
];
const SKIPPED_STEPS = {
    lightweight: new Set(['challenge', 'brainstorm', 'approve']),
    medium: new Set(['challenge']),
    heavyweight: new Set([]),
    strategic: new Set([]),
};
// ---------------------------------------------------------------------------
// Build pipeline steps from directive.json's pipeline{} object
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPipelineFromDirective(directive) {
    const weight = directive.weight ?? 'medium';
    const skipped = SKIPPED_STEPS[weight];
    const pipeline = directive.pipeline ?? {};
    // Build an ordered index so we can infer completed steps from current position
    const currentStepId = directive.current_step ?? '';
    const currentIdx = FULL_PIPELINE_STEPS.findIndex(s => s.id === currentStepId);
    return FULL_PIPELINE_STEPS
        .map((def, idx) => {
        const stepData = pipeline[def.id];
        const isSkipped = skipped?.has(def.id) && !stepData;
        // Infer status: if no explicit data but directive is past this step, treat as completed
        let inferredStatus = stepData?.status ?? 'pending';
        if (!stepData && !isSkipped && currentIdx > idx) {
            inferredStatus = 'completed';
        }
        const step = {
            id: def.id,
            label: def.label,
            status: isSkipped ? 'skipped' : inferredStatus,
        };
        // Build artifacts from step output + agent
        const artifacts = {};
        if (stepData?.agent)
            artifacts['Agent'] = stepData.agent;
        if (stepData?.reviewers?.length > 0) {
            artifacts['Reviewers'] = stepData.reviewers
                .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
                .join(', ');
        }
        if (stepData?.output && typeof stepData.output === 'object') {
            for (const [k, v] of Object.entries(stepData.output)) {
                if (typeof v === 'string' && v) {
                    artifacts[k.charAt(0).toUpperCase() + k.slice(1)] = v;
                }
            }
        }
        if (stepData?.artifacts?.length > 0) {
            artifacts['Files'] = stepData.artifacts
                .map((p) => String(p).split('/').pop())
                .join(', ');
        }
        if (Object.keys(artifacts).length > 0)
            step.artifacts = artifacts;
        if (step.status === 'active' && def.id === 'approve')
            step.needsAction = true;
        if (step.status === 'active' && def.id === 'completion')
            step.needsAction = true;
        if (directive.status === 'awaiting_completion' && def.id === 'completion') {
            step.status = 'active';
            step.needsAction = true;
        }
        if (step.status === 'active' && directive.updated_at)
            step.startedAt = directive.updated_at;
        return step;
    });
}
// Derive pipeline steps when directive.json has no pipeline{} (legacy or simple)
function derivePipelineSteps(weight, directiveStatus) {
    const skipped = SKIPPED_STEPS[weight];
    const isCompleted = directiveStatus === 'completed';
    const isFailed = directiveStatus === 'failed';
    return FULL_PIPELINE_STEPS.map((def) => {
        const isSkipped = skipped?.has(def.id);
        let status;
        if (isSkipped)
            status = 'skipped';
        else if (isCompleted)
            status = 'completed';
        else if (isFailed)
            status = def.id === 'wrapup' || def.id === 'completion' ? 'failed' : 'completed';
        else
            status = 'pending';
        return { id: def.id, label: def.label, status };
    });
}
// ---------------------------------------------------------------------------
// Map directive.json status to DirectiveState status
// ---------------------------------------------------------------------------
function mapStatus(status) {
    switch (status) {
        case 'in_progress': return 'in_progress';
        case 'awaiting_completion': return 'awaiting_completion';
        case 'completed': return 'completed';
        case 'failed': return 'failed';
        case 'cancelled': return 'completed';
        case 'pending': return 'pending';
        case 'triaged': return 'pending';
        default: return 'pending';
    }
}
// ---------------------------------------------------------------------------
// DirectiveWatcher — watches directive.json files directly
// No more current.json dependency — derives everything from directive.json
// + project.json files in the directive's projects/ subdirectory.
// ---------------------------------------------------------------------------
export class DirectiveWatcher {
    directivesWatcher = null;
    aggregator;
    directivesDir;
    debounceTimer = null;
    pollTimer = null;
    _ready = false;
    /** Snapshot of last emitted state hash for change detection in poll fallback */
    lastStateHash = '';
    /** mtime-based cache: dirId -> { mtimeMs, state } */
    historyCache = new Map();
    constructor(aggregator, _claudeHome) {
        this.aggregator = aggregator;
        this.directivesDir = resolveDirectivesDir();
    }
    start() {
        // Read initial state
        this.readAndUpdate();
        // Watch .context/directives/ for directive.json and project.json changes
        if (!fs.existsSync(this.directivesDir)) {
            try {
                fs.mkdirSync(this.directivesDir, { recursive: true });
            }
            catch {
                console.log(`[directive-watcher] Could not create directives dir, skipping`);
                this._ready = true;
                return;
            }
        }
        console.log(`[directive-watcher] Watching directives at ${this.directivesDir}`);
        this.directivesWatcher = watch(this.directivesDir, {
            ignoreInitial: true,
            persistent: true,
            depth: 4, // Deep enough for {id}/projects/{proj-id}/project.json
            awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        });
        this.directivesWatcher.on('all', (_event, filePath) => {
            if (!filePath.endsWith('.json'))
                return;
            this.handleChange();
        });
        this.directivesWatcher.on('ready', () => {
            this._ready = true;
            console.log(`[directive-watcher] Ready`);
        });
        this.directivesWatcher.on('error', (err) => {
            console.error(`[directive-watcher] Error:`, err);
        });
        // Periodic poll fallback — catches missed chokidar events (macOS FSEvents limits, awaitWriteFinish stalls)
        this.pollTimer = setInterval(() => {
            this.pollForChanges();
        }, 5000);
    }
    get ready() {
        return this._ready;
    }
    async stop() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        if (this.directivesWatcher) {
            await this.directivesWatcher.close();
            this.directivesWatcher = null;
        }
    }
    /**
     * Find the active directive (status = in_progress or awaiting_completion)
     * and build DirectiveState from directive.json + project.json files.
     */
    readCurrentState() {
        try {
            const dirIds = this.listDirs(this.directivesDir);
            // Find all active directives, pick the most recently updated
            let best = null;
            for (const dirId of dirIds) {
                const directive = this.readDirectiveJson(dirId);
                if (!directive)
                    continue;
                const status = String(directive.status ?? '');
                if (status !== 'in_progress' && status !== 'awaiting_completion')
                    continue;
                const updatedAt = String(directive.updated_at ?? directive.started_at ?? directive.created ?? '');
                if (!best || updatedAt > best.updatedAt) {
                    best = { dirId, directive, updatedAt };
                }
            }
            if (best) {
                return this.buildStateFromDirective(best.dirId, best.directive);
            }
            return null;
        }
        catch (err) {
            console.error(`[directive-watcher] readCurrentState error:`, err);
            return null;
        }
    }
    /**
     * Return DirectiveState[] for all active directives (in_progress, awaiting_completion, reopened).
     * Filters from readAllDirectiveStates() to get only actionable ones.
     */
    readActiveDirectives() {
        const all = this.readAllDirectiveStates();
        const activeStatuses = new Set(['in_progress', 'awaiting_completion']);
        return all.filter((d) => activeStatuses.has(d.status));
    }
    /**
     * Build DirectiveState[] for ALL directives (completed, failed, in_progress, etc.).
     * Uses mtime-based caching so we only re-parse directive.json when it changes.
     */
    readAllDirectiveStates() {
        try {
            const dirIds = this.listDirs(this.directivesDir);
            const results = [];
            const seenIds = new Set();
            for (const dirId of dirIds) {
                seenIds.add(dirId);
                const filePath = path.join(this.directivesDir, dirId, 'directive.json');
                // Check mtime for cache validity
                let mtimeMs;
                try {
                    const stat = fs.statSync(filePath);
                    mtimeMs = stat.mtimeMs;
                }
                catch {
                    // No directive.json in this dir — skip
                    continue;
                }
                const cached = this.historyCache.get(dirId);
                if (cached && cached.mtimeMs === mtimeMs && cached.state.status !== 'in_progress' && cached.state.status !== 'awaiting_completion') {
                    results.push(cached.state);
                    continue;
                }
                // Cache miss — re-parse
                const directive = this.readJson(filePath);
                if (!directive)
                    continue;
                const state = this.buildStateFromDirective(dirId, directive);
                this.historyCache.set(dirId, { mtimeMs, state });
                results.push(state);
            }
            // Prune deleted directives from cache
            for (const cachedId of this.historyCache.keys()) {
                if (!seenIds.has(cachedId)) {
                    this.historyCache.delete(cachedId);
                }
            }
            return results;
        }
        catch (err) {
            console.error(`[directive-watcher] readAllDirectiveStates error:`, err);
            return [];
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildStateFromDirective(dirId, directive) {
        // Read projects from the directive's projects/ subdirectory
        const projectsDir = path.join(this.directivesDir, dirId, 'projects');
        const projects = [];
        if (fs.existsSync(projectsDir)) {
            const projIds = this.listDirs(projectsDir);
            for (const projId of projIds) {
                const projJsonPath = path.join(projectsDir, projId, 'project.json');
                const projJson = this.readJson(projJsonPath);
                if (!projJson)
                    continue;
                const tasks = Array.isArray(projJson.tasks) ? projJson.tasks : [];
                const totalTasks = tasks.length;
                const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'done').length;
                // Determine phase from current task status
                let phase = null;
                if (projJson.status === 'in_progress') {
                    const activeTask = tasks.find((t) => t.status === 'in_progress');
                    if (activeTask)
                        phase = 'build';
                }
                // Extract project-level agent and reviewers arrays
                const projAgent = Array.isArray(projJson.agent) ? projJson.agent.map(String) : [];
                const projReviewers = Array.isArray(projJson.reviewers) ? projJson.reviewers.map(String) : [];
                projects.push({
                    id: projId,
                    title: String(projJson.title ?? projId),
                    status: this.mapProjectStatus(String(projJson.status ?? 'pending')),
                    phase,
                    totalTasks,
                    completedTasks,
                    agent: projAgent,
                    reviewers: projReviewers,
                    tasks: tasks.map((t) => ({
                        title: String(t.title ?? ''),
                        status: String(t.status ?? 'pending'),
                        agent: t.agent ? String(t.agent) : undefined,
                        dod: Array.isArray(t.dod) ? t.dod.map((d) => ({
                            criterion: String(d.criterion ?? ''),
                            met: !!d.met,
                        })) : undefined,
                    })),
                });
            }
        }
        // Also check produced_projects for projects stored elsewhere
        if (Array.isArray(directive.produced_projects)) {
            for (const prodPath of directive.produced_projects) {
                const prodId = String(prodPath).split('/').pop() ?? '';
                // Skip if already found in directive's projects/ dir
                if (projects.some(p => p.id === prodId))
                    continue;
                // Projects are now always under directive's projects/ dir
            }
        }
        const completedCount = projects.filter(p => p.status === 'completed').length;
        const executeOutput = directive.pipeline?.execute?.output;
        const currentStep = directive.current_step ?? '';
        // Determine current phase from pipeline state (named step IDs)
        let currentPhase = 'unknown';
        if (currentStep === 'execute' || currentStep === 'review-gate')
            currentPhase = 'executing';
        else if (currentStep === 'wrapup')
            currentPhase = 'wrapup';
        else if (currentStep === 'completion')
            currentPhase = 'completion';
        else if (['triage', 'read', 'context', 'challenge', 'brainstorm', 'plan', 'audit', 'approve', 'project-brainstorm', 'setup'].includes(currentStep))
            currentPhase = 'planning';
        else if (directive.pipeline?.execute?.status === 'completed')
            currentPhase = 'wrapup';
        // Build pipeline steps
        let pipelineSteps;
        if (directive.pipeline && Object.keys(directive.pipeline).length > 0) {
            pipelineSteps = buildPipelineFromDirective(directive);
        }
        else {
            pipelineSteps = derivePipelineSteps(directive.weight ?? 'medium', directive.status);
        }
        return {
            directiveName: dirId,
            title: directive.title ?? dirId,
            status: mapStatus(directive.status),
            totalProjects: projects.length,
            currentProject: completedCount,
            currentPhase,
            projects,
            startedAt: directive.started_at ?? directive.created ?? new Date().toISOString(),
            lastUpdated: directive.updated_at ?? new Date().toISOString(),
            pipelineSteps,
            currentStepId: currentStep,
            weight: directive.weight,
            triageRationale: directive.triage?.rationale,
            approvalStatus: directive.planning?.ceo_approval?.status,
            brainstormSummary: directive.pipeline?.brainstorm?.output?.summary,
            planSummary: directive.pipeline?.plan?.output?.summary ?? directive.pipeline?.plan?.output?.projects,
            brainstormContent: this.readTextFile(path.join(this.directivesDir, dirId, 'brainstorm.md')),
            directiveBrief: this.readTextFile(path.join(this.directivesDir, dirId, 'directive.md')),
        };
    }
    mapProjectStatus(status) {
        switch (status) {
            case 'completed': return 'completed';
            case 'in_progress': return 'in_progress';
            case 'failed': return 'failed';
            case 'skipped': return 'skipped';
            default: return 'pending';
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readDirectiveJson(dirId) {
        const filePath = path.join(this.directivesDir, dirId, 'directive.json');
        return this.readJson(filePath);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readJson(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    readTextFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        }
        catch {
            return undefined;
        }
    }
    listDirs(dirPath) {
        try {
            return fs.readdirSync(dirPath).filter((name) => {
                if (name.startsWith('.') || name.startsWith('_'))
                    return false;
                try {
                    return fs.statSync(path.join(dirPath, name)).isDirectory();
                }
                catch {
                    return false;
                }
            });
        }
        catch {
            return [];
        }
    }
    /**
     * Poll fallback: check if any directive.json or project.json mtimes changed
     * since the last update. Only triggers readAndUpdate if changes detected.
     */
    pollForChanges() {
        try {
            const dirIds = this.listDirs(this.directivesDir);
            // Build a lightweight hash from mtimes of all directive.json + project.json files
            const parts = [];
            for (const dirId of dirIds) {
                try {
                    const stat = fs.statSync(path.join(this.directivesDir, dirId, 'directive.json'));
                    parts.push(`${dirId}:${stat.mtimeMs}`);
                }
                catch {
                    continue;
                }
                // Also check project.json files
                const projDir = path.join(this.directivesDir, dirId, 'projects');
                try {
                    const projIds = fs.readdirSync(projDir);
                    for (const pId of projIds) {
                        try {
                            const pStat = fs.statSync(path.join(projDir, pId, 'project.json'));
                            parts.push(`${dirId}/${pId}:${pStat.mtimeMs}`);
                        }
                        catch {
                            continue;
                        }
                    }
                }
                catch { /* no projects dir */ }
            }
            const hash = parts.join('|');
            if (hash !== this.lastStateHash) {
                this.lastStateHash = hash;
                this.readAndUpdate();
            }
        }
        catch {
            // Poll failure is non-critical
        }
    }
    handleChange() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.readAndUpdate();
        }, 300);
    }
    readAndUpdate() {
        // Single pass: read all directives once, derive active + best from the result
        const history = this.readAllDirectiveStates();
        const activeStatuses = new Set(['in_progress', 'awaiting_completion']);
        const activeDirectives = history.filter((d) => activeStatuses.has(d.status));
        // Pick the most recently updated active directive as the singular state (backward compat)
        let state = null;
        for (const d of activeDirectives) {
            if (!state || d.lastUpdated > state.lastUpdated) {
                state = d;
            }
        }
        console.log(`[directive-watcher] Directive state: ${state ? `${state.directiveName} (${state.status}, ${state.currentProject}/${state.totalProjects})` : 'none'} | history: ${history.length} directives | active: ${activeDirectives.length}`);
        this.aggregator.updateDirectiveState(state, history, activeDirectives);
    }
}
