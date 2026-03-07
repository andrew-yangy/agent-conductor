import path from 'node:path';
import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Aggregator } from '../state/aggregator.js';
import type { ConductorConfig } from '../types.js';
import { consumerRoot } from '../paths.js';
import type {
  FeaturesState,
  BacklogsState,
  ConductorState,
  IndexState,
  FullWorkState,
  FeatureRecord,
  BacklogRecord,
  DirectiveRecord,
  LessonRecord,
} from '../state/work-item-types.js';

/**
 * Watches .context/ source files (directive.json, project.json,
 * reports, lessons) and builds FullWorkState directly.
 *
 * Replaces the old two-stage pipeline (ContextWatcher -> indexer -> state/*.json -> StateWatcher).
 * Now reads source files directly via glob patterns.
 */
export class StateWatcher {
  private watchers: FSWatcher[] = [];
  private aggregator: Aggregator;
  private config: ConductorConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _ready = false;
  private _state: FullWorkState = {
    features: null,
    backlogs: null,
    conductor: null,
    index: null,
  };

  constructor(aggregator: Aggregator, config: ConductorConfig) {
    this.aggregator = aggregator;
    this.config = config;
  }

  start(): void {
    if (this.config.projects.length === 0) {
      console.log('[state-watcher] No projects configured, skipping');
      this._ready = true;
      return;
    }

    // Read initial state
    this.readAndUpdate();

    for (const project of this.config.projects) {
      const contextDir = path.join(project.path, '.context');

      if (!fs.existsSync(contextDir)) {
        console.log(`[state-watcher] No .context/ dir for ${project.name}, skipping`);
        continue;
      }

      console.log(`[state-watcher] Watching ${contextDir} (${project.name})`);

      const watcher = watch(contextDir, {
        ignoreInitial: true,
        persistent: true,
        ignored: [
          '**/node_modules/**',
          // Ignore checkpoints dir to avoid feedback loops
          path.join(contextDir, 'directives', 'checkpoints', '**'),
        ],
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 50,
        },
        depth: 5,
      });

      watcher.on('all', (_event: string, filePath: string) => {
        if (!filePath.endsWith('.json') && !filePath.endsWith('.md')) return;
        this.handleChange();
      });

      watcher.on('ready', () => {
        console.log(`[state-watcher] Ready for ${project.name}`);
      });

      watcher.on('error', (err: unknown) => {
        console.error(`[state-watcher] Error for ${project.name}:`, err);
      });

      this.watchers.push(watcher);
    }

    this._ready = true;
  }

  get ready(): boolean {
    return this._ready;
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const watcher of this.watchers) {
      await watcher.close();
    }
    this.watchers = [];
  }

  readCurrentState(): FullWorkState {
    return this._state;
  }

  /** Force a re-read of all source files */
  refresh(): void {
    this.readAndUpdate();
  }

  private handleChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.readAndUpdate();
    }, 500);
  }

  private readAndUpdate(): void {
    const state: FullWorkState = {
      features: null,
      backlogs: null,
      conductor: null,
      index: null,
    };

    const generated = new Date().toISOString();
    const allProjects: FeatureRecord[] = [];
    const allBacklog: BacklogRecord[] = [];
    const allDirectives: DirectiveRecord[] = [];
    const allReports: Array<{
      id: string; type: 'report'; title: string; status: 'done';
      createdAt: string; updatedAt: string; filePath: string;
      contentSummary?: string; sourceDirective?: string;
    }> = [];
    const allLessons: LessonRecord[] = [];

    for (const project of this.config.projects) {
      const contextDir = path.join(project.path, '.context');
      if (!fs.existsSync(contextDir)) continue;

      // Derive repoId from the project path (last directory component, lowercased)
      const repoId = path.basename(project.path).toLowerCase();
      const repoName = project.name;

      // --- Directives (directory format: {id}/directive.json) ---
      const directivesDir = path.join(contextDir, 'directives');
      if (fs.existsSync(directivesDir)) {
        const directiveDirs = this.listDirs(directivesDir);
        for (const dirId of directiveDirs) {
          const filePath = path.join(directivesDir, dirId, 'directive.json');
          const dirJson = this.readJson(filePath) as Record<string, unknown> | null;
          if (!dirJson) continue;

          const dirStatus = this.mapDirectiveStatus(String(dirJson.status ?? 'pending'));

          allDirectives.push({
            id: dirId,
            type: 'directive',
            title: String(dirJson.title ?? dirId),
            status: dirStatus,
            createdAt: String(dirJson.created ?? generated),
            updatedAt: String(dirJson.updated ?? dirJson.created ?? generated),
            projects: [],
            weight: dirJson.weight ? String(dirJson.weight) : undefined,
            producedFeatures: Array.isArray(dirJson.produced_features) ? dirJson.produced_features.map(String) : undefined,
            report: dirJson.report != null ? String(dirJson.report) : null,
            backlogSources: Array.isArray(dirJson.backlog_sources) ? dirJson.backlog_sources.map(String) : undefined,
          });

          // --- Projects under this directive ---
          const projectsDir = path.join(directivesDir, dirId, 'projects');
          if (fs.existsSync(projectsDir)) {
            const projectIds = this.listDirs(projectsDir);
            for (const projId of projectIds) {
              const projJsonPath = path.join(projectsDir, projId, 'project.json');
              const projJson = this.readJson(projJsonPath) as Record<string, unknown> | null;
              if (!projJson) continue;

              const tasks = Array.isArray(projJson.tasks) ? projJson.tasks as Array<Record<string, unknown>> : [];
              const taskCount = tasks.length;
              const completedTaskCount = tasks.filter(
                (t) => t.status === 'completed' || t.status === 'done'
              ).length;

              const projStatus = this.mapProjectStatus(String(projJson.status ?? 'pending'));
              const featureId = `${dirId}/${projId}`;

              const record: FeatureRecord = {
                id: featureId,
                type: 'feature',
                title: String(projJson.title ?? projId),
                status: projStatus,
                createdAt: String(projJson.created ?? generated),
                updatedAt: String(projJson.updated ?? generated),
                taskCount,
                completedTaskCount,
                hasSpec: false,
                hasDesign: false,
                specSummary: projJson.description
                  ? String(projJson.description).slice(0, 200)
                  : undefined,
                repoId,
                repoName,
              };

              allProjects.push(record);
            }
          }
        }
      }

      // --- Reports ---
      const reportsDir = path.join(contextDir, 'reports');
      if (fs.existsSync(reportsDir)) {
        const mdFiles = this.listFiles(reportsDir, '.md');
        for (const file of mdFiles) {
          const filePath = path.join(reportsDir, file);
          const title = this.extractFirstHeading(filePath) || file.replace('.md', '');
          const mtime = this.fileMtime(filePath);

          const directiveMatch = file.match(/^(.+?)(?:-v\d+)?-\d{4}-\d{2}-\d{2}\.md$/);
          const sourceDirective = directiveMatch ? directiveMatch[1] : undefined;

          allReports.push({
            id: `report/${file.replace('.md', '')}`,
            type: 'report',
            title,
            status: 'done',
            createdAt: mtime,
            updatedAt: mtime,
            filePath: `reports/${file}`,
            sourceDirective,
          });
        }
      }

      // --- Lessons ---
      const lessonsDir = path.join(contextDir, 'lessons');
      if (fs.existsSync(lessonsDir)) {
        const mdFiles = this.listFiles(lessonsDir, '.md');
        for (const file of mdFiles) {
          const filePath = path.join(lessonsDir, file);
          const title = this.extractFirstHeading(filePath) || file.replace('.md', '');
          const lessonId = file.replace('.md', '');

          allLessons.push({
            id: lessonId,
            title,
            filePath: `lessons/${file}`,
            topics: [lessonId],
            updatedAt: this.fileMtime(filePath),
          });
        }
      }
    }

    // Build state objects
    state.features = { generated, features: allProjects };
    state.backlogs = { generated, items: allBacklog };
    state.conductor = {
      generated,
      directives: allDirectives,
      reports: allReports as unknown as ConductorState['reports'],
      discussions: [],
      research: [],
      lessons: allLessons,
    };
    state.index = {
      generated,
      counts: {
        activeFeatures: allProjects.filter((f) => f.status !== 'completed').length,
        doneFeatures: allProjects.filter((f) => f.status === 'completed').length,
        pendingTasks: 0, // TODO: aggregate from project tasks
        completedTasks: 0,
        backlogItems: allBacklog.filter((b) => b.status !== 'completed').length,
        directives: allDirectives.length,
        reports: allReports.length,
        discussions: 0,
        lessons: allLessons.length,
      },
    };

    this._state = state;

    const projectCount = allProjects.length;
    const backlogCount = allBacklog.length;
    const directiveCount = allDirectives.length;
    console.log(
      `[state-watcher] Direct read: ${projectCount} projects, ${backlogCount} backlog items, ${directiveCount} directives`
    );

    this.aggregator.updateWorkState(state);
  }

  // --- Status Mappers ---

  private mapProjectStatus(status: string): 'pending' | 'in_progress' | 'blocked' | 'deferred' | 'completed' | 'abandoned' {
    switch (status) {
      case 'in_progress': return 'in_progress';
      case 'active': return 'in_progress'; // legacy
      case 'pending': return 'pending';
      case 'proposed': return 'pending';
      case 'completed': return 'completed';
      case 'blocked': return 'blocked';
      case 'deferred': return 'deferred';
      case 'abandoned': return 'abandoned';
      default: return 'pending';
    }
  }

  private mapDirectiveStatus(status: string): 'pending' | 'in_progress' | 'blocked' | 'deferred' | 'completed' | 'abandoned' {
    switch (status) {
      case 'pending': return 'pending';
      case 'triaged': return 'pending';
      case 'in_progress': return 'in_progress';
      case 'executing': return 'in_progress'; // legacy
      case 'awaiting_completion': return 'in_progress';
      case 'completed': return 'completed';
      case 'cancelled': return 'abandoned';
      case 'rejected': return 'abandoned';
      default: return 'pending';
    }
  }

  private mapBacklogStatus(status: string): 'pending' | 'in_progress' | 'blocked' | 'deferred' | 'completed' | 'abandoned' {
    switch (status) {
      case 'pending': return 'pending';
      case 'proposed': return 'pending';
      case 'approved': return 'pending';
      case 'promoted': return 'completed';
      case 'in_progress': return 'in_progress';
      case 'completed': return 'completed';
      case 'deferred': return 'deferred';
      case 'blocked': return 'blocked';
      case 'rejected': return 'abandoned';
      default: return 'pending';
    }
  }

  private mapPriority(p: unknown): 'P0' | 'P1' | 'P2' | undefined {
    const s = String(p ?? '').toUpperCase();
    if (s === 'P0') return 'P0';
    if (s === 'P1') return 'P1';
    if (s === 'P2') return 'P2';
    return undefined;
  }

  // --- File Helpers ---

  private readJson(filePath: string): unknown {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private listDirs(dirPath: string): string[] {
    try {
      return fs.readdirSync(dirPath).filter((name) => {
        if (name.startsWith('.') || name.startsWith('_')) return false;
        try {
          return fs.statSync(path.join(dirPath, name)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }

  private listFiles(dirPath: string, ext?: string): string[] {
    try {
      return fs.readdirSync(dirPath).filter((name) => {
        if (name.startsWith('.')) return false;
        if (ext && !name.endsWith(ext)) return false;
        try {
          return fs.statSync(path.join(dirPath, name)).isFile();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }

  private extractFirstHeading(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/^#\s+(.+)/m);
      return match ? match[1].trim() : '';
    } catch {
      return '';
    }
  }

  private fileMtime(filePath: string): string {
    try {
      return fs.statSync(filePath).mtime.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }
}
