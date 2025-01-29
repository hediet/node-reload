import { IDisposable } from "./disposable";

export class Debouncer implements IDisposable {
    private _timeout: NodeJS.Timeout | undefined;

    run(delayMs: number, cb: () => void): void {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }
        this._timeout = setTimeout(cb, delayMs);
    }

    dispose(): void {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }
    }
}

type Task<T> = () => Promise<T>;

export class AsyncQueue {
    private readonly _queue: Task<any>[] = [];
    private _running: boolean = false;

    private async _runNext(): Promise<void> {
        if (this._running || this._queue.length === 0) {
            return;
        }
        this._running = true;
        const task = this._queue.shift()!;
        try {
            await task();
        } finally {
            this._running = false;
            this._runNext();
        }
    }

    schedule<T>(task: Task<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this._queue.push(async () => {
                try {
                    resolve(await task());
                } catch (error) {
                    reject(error);
                }
            });
            this._runNext();
        });
    }

    clear(): void {
        this._queue.length = 0;
    }
}

export type Event<T> = (listener: (args: T) => void) => IDisposable;

export class EventEmitter<T = void> {
    private readonly _listeners = new Set<(args: T) => void>();

    emit(args: T): void {
        for (const listener of this._listeners) {
            listener(args);
        }
    }

    event: Event<T> = (listener) => {
        this._listeners.add(listener);
        return {
            dispose: () => {
                this._listeners.delete(listener);
            }
        };
    };
}

export class Node<T> {
    constructor(
        public readonly value: T,
        public readonly outNodes: Node<T>[] = [],
        public readonly inNodes: Node<T>[] = [],
    ) { }
}

export class Graph<T> {
    public static build<T>(roots: T[], getOut: (value: T) => T[]): Graph<T> {
        const nodes = new Map<T, Node<T>>();
        const getNode = (value: T): Node<T> => {
            let node = nodes.get(value);
            if (!node) {
                node = new Node(value);
                nodes.set(value, node);
            }
            return node;
        };
        const build = (value: T): Node<T> => {
            const node = getNode(value);
            for (const out of getOut(value)) {
                const outNode = build(out);
                node.outNodes.push(outNode);
                outNode.inNodes.push(node);
            }
            return node;
        };
        const rootNodes = roots.map(build);
        return new Graph(rootNodes);
    }

    constructor(
        public readonly roots: Node<T>[],
    ) { }
}
