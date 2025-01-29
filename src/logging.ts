import { HotReloadOptions } from "./node";
import * as path from "path";

export enum LogLevel {
    Off = 0,
    Warn = 1,
    Info = 2,
    Trace = 3,
    Debug = 4,
}

export function getLogLevel(options: HotReloadOptions['logging']): LogLevel {
    if (options === false) { return LogLevel.Off; }
    if (options === 'info' || options === true) { return LogLevel.Info; }
    if (options === 'trace') { return LogLevel.Trace; }
    if (options === 'debug') { return LogLevel.Debug; }
    return LogLevel.Info;
}

export class Logger {
    private _indentation: number = 0;

    private static readonly TREE_BRANCH = '├── ';
    private static readonly TREE_VERTICAL = '│  ';

    constructor(
        private readonly _logLevel: LogLevel,
        private readonly _root: string = process.cwd(),
    ) { }

    private _formatPath(filepath: string): string {
        const result = path.relative(this._root, filepath);
        if (!path.isAbsolute(result)) {
            // so that ctrl+click works in vscode
            return `.${path.sep}${result}`;
        }
        return result;
    }

    public logHotReloadActive(): boolean {
        return this._log(LogLevel.Info, `Hot reload active`);
    }

    public logTrackingRequire(request: string, moduleFilename: string, resolvedFilename: string): boolean {
        return this._log(LogLevel.Trace, `Tracking require from "${this._formatPath(moduleFilename)}" of "${request}" (resolved to "${this._formatPath(resolvedFilename)}")`);
    }

    public logSkippingRequire(request: string, filename: string, reason: string): boolean {
        return this._log(LogLevel.Debug, `Skipping require of "${request}" from "${this._formatPath(filename)}" (${reason})`);
    }

    public logResolvingError(request: string, filename: string, error: unknown): boolean {
        const detail = this._logLevel >= LogLevel.Debug ? ` (error: ${error})` : '';
        return this._log(LogLevel.Warn, `Error while resolving module "${request}" from "${this._formatPath(filename)}"${detail}`);
    }

    public logFilesChanged(filenames: string[]): boolean {
        return this._log(LogLevel.Info, `File(s) changed: ${filenames.map(f => this._formatPath(f)).join(', ')}`);
    }

    public logUpdatingModule(filename: string): boolean {
        return this._log(LogLevel.Trace, `Updating "${this._formatPath(filename)}"...`);
    }

    public logClearingModule(filename: string): boolean {
        return this._log(LogLevel.Trace, `Clearing "${this._formatPath(filename)}"`);
    }

    public logModuleUpdated(filename: string): boolean {
        return this._log(LogLevel.Info, `Successfully updated "${this._formatPath(filename)}"`);
    }

    public logUpdateFailed(filename: string, consumerCount: number): boolean {
        return this._log(LogLevel.Trace, `Could not update "${this._formatPath(filename)}", updating ${consumerCount} consumer(s)...`);
    }

    public logEntryModuleUpdateFailed(filename: string): boolean {
        return this._log(LogLevel.Warn, `Could not update entry module "${this._formatPath(filename)}"!`);
    }

    public logRecursiveUpdate(stackFilenames: string[]): boolean {
        const level = LogLevel.Info;
        if (!this._isLoggingEnabled(level)) {
            return false;
        }
        this._log(level, `Skipping recursive dependency update:`);
        this.indent();
        let first = true;
        for (const stackFilename of stackFilenames.reverse()) {
            this._log(level, `  ${first ? '' : `...requires `}"${this._formatPath(stackFilename)}"`);
            first = false;
        }
        this.unindent();

        return true;
    }

    public logPostponeEndUpdate(filename: string, updateCounter: number): boolean {
        return this._log(LogLevel.Trace, `Postponing endUpdate of "${this._formatPath(filename)}" (${updateCounter})`);
    }

    private _isLoggingEnabled(level: LogLevel): boolean {
        return this._logLevel >= level;
    }

    private _getIndentation(): string {
        let result = '';
        for (let i = 0; i < this._indentation; i++) {
            result += i === this._indentation - 1 ? Logger.TREE_BRANCH : Logger.TREE_VERTICAL;
        }
        return result;
    }

    private _log(level: LogLevel, message: string): boolean {
        if (!this._isLoggingEnabled(level)) {
            return false;
        }
        const indentation = this._getIndentation();
        console.log(`[node-reload] ${indentation}${message}`);
        return true;
    }

    public indent(): void {
        this._indentation++;
    }

    public unindent(): void {
        this._indentation--;
    }
}
