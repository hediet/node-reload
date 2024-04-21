export class AttachedProperty<TTarget extends object, TValue> {
    private readonly _map = new WeakMap<TTarget, TValue>();

    constructor(private readonly defaultValueCtor: () => TValue) {}

    get(target: TTarget): TValue {
        let value = this._map.get(target);
        if (value === undefined) {
            value = this.defaultValueCtor();
            this._map.set(target, value);
        }
        return value;
    }

    set(target: TTarget, value: TValue): void {
        this._map.set(target, value);
    }
}

/**
 * Represents a type which can release resources, such
 * as event listening or a timer.
 */
export interface Disposable {
	/**
	 * Disposes this object.
	 */
	dispose(): void;
}

/**
 * Represents a type which is like a `Disposable`.
 */
export type DisposableLike =
	| Disposable
	| ReadonlyArray<Disposable>
	| Set<Disposable>
	| undefined
	| void;

export namespace Disposable {
	export function create(
		disposable?: DisposableLike | (() => void)
	): Disposable {
		if (!disposable) return empty;
		if (disposable instanceof Function) return { dispose: disposable };
		if ("dispose" in disposable) return disposable as Disposable;
		else if (disposable instanceof Set)
			return new ArrayDisposer([...disposable]);
		else if (disposable.length > 0) return new ArrayDisposer(disposable);

		return empty;
	}
	export const empty: Disposable = { dispose: () => {} };

	export function normalize(
		disposable: DisposableLike
	): ReadonlyArray<Disposable> {
		if (!disposable) return [];
		if (disposable instanceof ArrayDisposer) return disposable.items;
		if ("dispose" in disposable) return [disposable as Disposable];
		if (disposable instanceof Set) return [...disposable];
		else return disposable;
	}

	export function fn(
		callback?: (track: TrackFunction, untrack: TrackFunction) => void
	): { (): void } & Disposer {
		const d = new Disposer();
		if (callback) {
			callback(
				disposable => d.track(disposable),
				disposable => d.untrack(disposable)
			);
		}

		function dispose() {
			d.dispose();
		}
		dispose.track = d.track.bind(d);
		dispose.untrack = d.untrack.bind(d);
		dispose.dispose = d.dispose;
		Object.defineProperty(dispose, "disposed", {
			get() {
				return d.disposed;
			},
		});

		return dispose as any;
	}
	
	export function is(obj: unknown): obj is Disposable {
		if (typeof obj !== 'object' || !obj) {
			return false;
		}

		if (!('dispose' in obj)) {
			return false;
		}

		const d: Function | null = (obj as any).dispose;
		if (typeof d !== 'function') {
			return false;
		}
		if (d.length !== 0) {
			return false;
		}
		return true;
	}
}

class ArrayDisposer implements Disposable {
	constructor(public readonly items: ReadonlyArray<Disposable>) {}

	dispose() {
		dispose(this.items);
	}
}

// See https://github.com/Microsoft/TypeScript/issues/17002
function isArray(item: any): item is ReadonlyArray<any> {
	return Array.isArray(item);
}

export function dispose(disposable: DisposableLike) {
	if (!disposable) return;

	if (isArray(disposable) || disposable instanceof Set) {
		for (var d of disposable) {
			d.dispose();
		}
	} else {
		disposable.dispose();
	}
}

export type TrackFunction = <T extends DisposableLike>(disposable: T) => T;

export class Disposer implements Disposable {
	private disposables = new Set<Disposable>();

	public track<T extends DisposableLike>(disposable: T): T {
		for (const d of Disposable.normalize(disposable)) {
			this.disposables.add(d);
		}
		return disposable;
	}

	public untrack<T extends DisposableLike>(disposable: T): T {
		for (const d of Disposable.normalize(disposable)) {
			this.disposables.delete(d);
		}
		return disposable;
	}

	public disposed = false;

	public readonly dispose = () => {
		this.disposed = true;
		dispose(this.disposables);
		this.disposables.clear();
	};
}

export function disposeOnReturn<T>(
	callback: (track: TrackFunction, untrack: TrackFunction) => T
): T {
	let wasPromise = false;
	const disposables = new Set<Disposable>();
	try {
		const result = callback(
			disposable => {
				for (const d of Disposable.normalize(disposable)) {
					disposables.add(d);
				}
				return disposable;
			},
			disposable => {
				for (const d of Disposable.normalize(disposable)) {
					disposables.delete(d);
				}
				return disposable;
			}
		);
		if (isPromise(result)) {
			wasPromise = true;

			return (async function test() {
				try {
					return await result;
				} finally {
					dispose(disposables);
				}
			})() as any;
		}

		return result;
	} finally {
		if (!wasPromise) {
			dispose(disposables);
		}
	}
}

function isPromise(obj: any): obj is Promise<unknown> {
	return (
		!!obj &&
		(typeof obj === "object" || typeof obj === "function") &&
		typeof (obj as any).then === "function"
	);
}

export function addAndDeleteOnDispose<T>(set: Set<T>, item: T): Disposable;
export function addAndDeleteOnDispose<TKey, TValue>(
	set: Map<TKey, TValue>,
	key: TKey,
	item: TValue
): Disposable;
export function addAndDeleteOnDispose(
	set: Set<any> | Map<any, any>,
	keyOrItem: any,
	item?: any
): Disposable {
	if (set instanceof Set) {
		set.add(keyOrItem);
		return Disposable.create(() => set.delete(keyOrItem));
	} else {
		set.set(keyOrItem, item);
		return Disposable.create(() => set.delete(keyOrItem));
	}
}
