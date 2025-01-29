import { HotReloadOptions } from "./node";
import { IDisposable } from "./disposable";
import { FileWatcher } from "./FileWatcher";
import { getLogLevel, Logger } from "./logging";
import { registerModuleInterceptors, resolveFileName, getLoadedModule, deleteModule, NodeJsModule, moduleFromNodeModule } from "./nodeApi";
import { EventEmitter } from "./utils";

export class HotReloadService {
    private static _instance: HotReloadService | undefined = undefined;
    public static get instance(): HotReloadService | undefined { return this._instance; }

    public static initialize(options: HotReloadOptions): void {
        if (this._instance) {
            if (!options.skipInitializationIfEnabled) {
                console.error('HotReloadService already initialized, ignoring subsequent initialization call. (Set skipInitializationIfEnabled option to true to suppress this warning.)');
            }
        } else {
            this._instance = new HotReloadService(
                new Logger(getLogLevel(options.logging), options.loggingFileRoot),
                predicateFromStringArray(options.ignoredModules ?? ['.*[/\\\\]node_modules[/\\\\].*']),
                predicateFromStringArray(options.ignoredModules ?? ['vscode']),
            );
            this._instance.trackModule(options.entryModule);
        }
    }

    public readonly interceptor = registerModuleInterceptors({
        interceptLoad: (module, filename) => {
            const loadResult = this.interceptor.originalLoad(module, filename);
            this._onAfterLoad(filename);
            return loadResult;
        },
        interceptRequire: (module, filename) => {
            const { didLog } = this._onBeforeRequire(module, filename);
            if (didLog) {
                this._logger.indent();
            }
            try {
                const result = this.interceptor.originalRequire(module, filename);
                return result;
            } finally {
                if (didLog) {
                    this._logger.unindent();
                }
            }
        },
    });

    private readonly _trackedModules = new Map<string, TrackedModule>();
    private readonly _watcher = new FileWatcher(filenames => this._handleFileChanges(filenames));
    private readonly _onTrackedModuleExportsLoaded = new EventEmitter<{ module: TrackedModule }>();
    public readonly onTrackedModuleExportsLoaded = this._onTrackedModuleExportsLoaded.event;

    constructor(
        private readonly _logger: Logger,
        private readonly _shouldIgnoreModule: (moduleFilename: string) => boolean,
        private readonly _shouldIgnoreRequireRequest: (request: string) => boolean,
    ) {
        this._logger.logHotReloadActive();
    }

    public trackModule(module: NodeModule): void {
        this._getOrCreateTrackedModule(module.filename);
        setTimeout(() => {
            this._onAfterLoad(module.filename);
        }, 0);
    }

    private _getOrCreateTrackedModule(filename: string): TrackedModule {
        const existing = this._trackedModules.get(filename);
        if (existing) {
            return existing;
        }
        const trackedModule = new TrackedModule(filename, this, this._logger, () => this._watcher.addFile(filename));
        this._trackedModules.set(filename, trackedModule);
        return trackedModule;
    }

    private _onBeforeRequire(module: NodeJsModule, request: string): { didLog: boolean } {
        if (this._shouldIgnoreRequireRequest(request)) {
            const didLog = this._logger.logSkippingRequire(request, module.filename, 'ignored require request');
            return { didLog };
        }

        const requiredByModule = this._trackedModules.get(module.filename);
        if (!requiredByModule) {
            const didLog = this._logger.logSkippingRequire(request, module.filename, 'caller not tracked');
            return { didLog };
        }

        let requiredModuleFilename: string;
        try {
            requiredModuleFilename = resolveFileName(request, module);
        } catch (e) {
            const didLog = this._logger.logResolvingError(request, module.filename, e);
            return { didLog };
        }

        if (this._shouldIgnoreModule(requiredModuleFilename)) {
            const didLog = this._logger.logSkippingRequire(request, module.filename, 'required module ignored');
            return { didLog };
        }

        const didLog = this._logger.logTrackingRequire(request, module.filename, requiredModuleFilename);
        const requiredModule = this._getOrCreateTrackedModule(requiredModuleFilename);
        requiredModule.consumers.add(requiredByModule);
        return { didLog };
    }

    private _onAfterLoad(filename: string): void {
        const loadedModule = this._trackedModules.get(filename);
        if (loadedModule) {
            loadedModule.watch();
            loadedModule.exports = getLoadedModule(filename)?.exports;
            this._onTrackedModuleExportsLoaded.emit({ module: loadedModule });
        }
    }

    private _handleFileChanges(filenames: string[]): void {
        const didLog = this._logger.logFilesChanged(filenames);
        if (didLog) {
            this._logger.indent();
        }
        try {
            const modules: TrackedModule[] = [];
            for (const filename of filenames) {
                const module = this._trackedModules.get(filename);
                if (module) {
                    modules.push(module);
                }
            }

            for (const module of modules) {
                module.beginUpdate([]);
                module.markChanged();
            }
            for (const module of modules) {
                module.endUpdate();
            }
        } finally {
            if (didLog) {
                this._logger.unindent();
            }
        }
    }

    public handleChange(moduleOrFilename: NodeModule | string): void {
        const moduleFilename = typeof moduleOrFilename === 'string'
            ? moduleOrFilename
            : moduleOrFilename.filename;
        this._handleFileChanges([moduleFilename]);
    }
}

function predicateFromStringArray(arr: string[]): (str: string) => boolean {
    const regexes = arr.map(s => new RegExp(s));
    return str => {
        return regexes.some(r => r.test(str));
    };
}

export class TrackedModule {
    public readonly consumers = new Set<TrackedModule>();

    public exports: Record<string, unknown> = {};

    private readonly _updateStrategies = new Set<IUpdateStrategy>();
    public readonly updateStrategies: ReadonlySet<IUpdateStrategy> = this._updateStrategies;

    public registerUpdateStrategy(strategy: IUpdateStrategy): IDisposable {
        this._updateStrategies.add(strategy);
        return {
            dispose: () => this._updateStrategies.delete(strategy),
        };
    }

    private _updateCounter = 0;
    private _updatedCosumers: TrackedModule[] = [];
    private _active = false;
    public get active(): boolean { return this._active; }
    private _moduleChanged = false;
    private readonly _changedDependencies: Set<ModuleChangeInfo> = new Set();
    private _watcher: IDisposable | undefined = undefined;

    constructor(
        public readonly filename: string,
        private readonly _hotReloadService: HotReloadService,
        private readonly _logger: Logger,
        private readonly _watch: () => IDisposable,
    ) { }

    public watch(): void {
        if (this._watcher) {
            return;
        }
        this._watcher = this._watch();
    }

    public beginUpdate(stack: TrackedModule[]): void {
        if (this._active) {
            throw new Error('Cannot begin update while update is in progress');
        }
        stack.push(this);
        this._active = true;
        this._updateCounter++;

        if (this._updateCounter === 1) {
            this._updatedCosumers = [];
            for (const c of this.consumers) {
                if (c.active) {
                    // recursion, ignore
                    stack.push(c);
                    this._logger.logRecursiveUpdate(stack.map(s => s.filename));
                    stack.pop();
                } else {
                    this._updatedCosumers.push(c);
                    c.beginUpdate(stack);
                }
            }
        }

        stack.pop();
        this._active = false;
    }

    public endUpdate(): void {
        if (this._active) {
            throw new Error('Cannot begin update while update is in progress');
        }
        try {
            let didLog = false;
            let didLogUpdatingModule = false;
            this._active = true;
            this._updateCounter--;
            if (this._updateCounter === 0) {
                if (this._moduleChanged || this._changedDependencies.size > 0) {
                    const changeInfo = new ModuleChangeInfo(this, this._moduleChanged, new Set(this._changedDependencies));
                    this._moduleChanged = false;
                    this._changedDependencies.clear();

                    didLogUpdatingModule = this._logger.logUpdatingModule(this.filename);
                    if (didLogUpdatingModule) {
                        this._logger.indent();
                    }

                    let couldApplyUpdate = false;
                    for (const u of this.updateStrategies) {
                        const r = u.applyUpdate(changeInfo);
                        couldApplyUpdate = couldApplyUpdate || r;
                    }
                    if (couldApplyUpdate) {
                        didLog = this._logger.logModuleUpdated(this.filename);
                    } else {
                        this.clearCache();
                        if (this._updatedCosumers.length === 0) {
                            didLog = this._logger.logEntryModuleUpdateFailed(this.filename);
                        } else {
                            didLog = this._logger.logUpdateFailed(this.filename, this._updatedCosumers.length);
                            for (const consumer of this._updatedCosumers) {
                                consumer.markDependencyChanged(changeInfo);
                            }
                        }
                    }
                }

                if (didLog) {
                    this._logger.indent();
                }
                for (const consumer of this._updatedCosumers) {
                    consumer.endUpdate();
                }
                if (didLog) {
                    this._logger.unindent();
                }
                if (didLogUpdatingModule) {
                    this._logger.unindent();
                }
                this._updatedCosumers = [];
            } else {
                this._logger.logPostponeEndUpdate(this.filename, this._updateCounter);
            }
        } finally {
            this._active = false;
        }
    }

    public markChanged(): void {
        this._checkUpdateInProgress();
        this._moduleChanged = true;
    }

    public markDependencyChanged(changeInfo: ModuleChangeInfo): void {
        this._checkUpdateInProgress();
        this._changedDependencies.add(changeInfo);
    }

    private _checkUpdateInProgress(): void {
        if (this._updateCounter === 0) {
            debugger;
            throw new Error('Cannot mark module as changed outside of an update');
        }
    }

    public clearCache(): void {
        this._logger.logClearingModule(this.filename);
        deleteModule(this.filename);
    }

    public reload(): void {
        this.clearCache();
        this._hotReloadService.interceptor.originalRequire(moduleFromNodeModule(module), this.filename);
    }

    public toString() {
        return `TrackedModule(${this.filename})`;
    }
}

export interface IUpdateStrategy {
    applyUpdate(changeInfo: ModuleChangeInfo): boolean;
}

export class ModuleChangeInfo {
    constructor(
        public readonly module: TrackedModule,
        /**
         * Is set, if the current module changed.
         */
        public readonly moduleChanged: boolean,
        /**
         * Describes the changes of the dependent modules.
         */
        public readonly dependencyChangeInfos: ReadonlySet<ModuleChangeInfo>,
    ) { }

    toString(): string {
        return JSON.stringify(this._toJson(), null, '\t');
    }

    private _toJson(): any {
        return {
            moduleChanged: this.moduleChanged,
            dependencyChangeInfos: Object.fromEntries(this.dependencyChangeInfos.entries()),
        };
    }
}
