import { FSWatcher, watch } from "fs";
import { IDisposable } from "./disposable";
import { readFile } from "fs/promises";
import { AsyncQueue } from "./utils";

export class FileWatcher {
    constructor(
        private readonly _handleChanges: (filenames: string[]) => void,
    ) { }

    private readonly _watchers = new Map<string, SingleFileWatcher>();

    private readonly _pendingFileWatchers = new Set<SingleFileWatcher>();
    private readonly _changedWatchers = new Set<SingleFileWatcher>();

    addFile(filename: string): IDisposable {
        if (this._watchers.get(filename)) {
            throw new Error(`Tracker for ${filename} already set!`);
        }

        const q = new AsyncQueue();
        const w = new SingleFileWatcher(filename, async () => {
            this._pendingFileWatchers.add(w);
            q.clear();
            q.schedule(() => wait(100));
            q.schedule(async () => {
                try {
                    const { didChange } = await w.update();
                    if (didChange) {
                        this._changedWatchers.add(w);
                    }
                } catch (e) {
                    console.error('unhandled error during update check', e);
                }
            });
            q.schedule(async () => {
                this._pendingFileWatchers.delete(w);
                if (this._pendingFileWatchers.size === 0) {
                    const filenames = Array.from(this._changedWatchers).map(w => w.filename);
                    this._changedWatchers.clear();
                    if (filenames.length > 0) {
                        this._handleChanges(filenames);
                    }
                }
            });
        });
        this._watchers.set(filename, w);
        return {
            dispose: () => {
                this._watchers.delete(filename);
                w.dispose();
            }
        };
    }
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class SingleFileWatcher implements IDisposable {
    private _fileContent: string | undefined = undefined;
    private _init: Promise<void>;
    private _watcher: FSWatcher;

    constructor(
        public readonly filename: string,
        private readonly _handleChange: () => void,
    ) {
        this._init = (async () => {
            const content = await readFile(filename, 'utf-8');
            this._fileContent = content;
        })();
        this._watcher = watch(filename, { persistent: false });
        this._watcher.on('change', this._handler);
    }

    dispose(): void {
        this._watcher.close();
    }

    private readonly _handler = () => {
        this._handleChange();
    };

    async update(): Promise<{ didChange: boolean }> {
        await this._init;
        const content = await readFile(this.filename, 'utf-8');
        const didChange = content !== this._fileContent;
        this._fileContent = content;
        return { didChange };
    }
}
