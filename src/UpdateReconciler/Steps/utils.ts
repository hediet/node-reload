export type DiffTuple<T1, T2> = { key: string; val1: T1; val2: T2 };
export type KeyDiff<T> =
	| DiffTuple<T, T>
	| DiffTuple<T, undefined>
	| DiffTuple<undefined, T>;
export function diffObjectsKeys<T>(obj1: object, obj2: object): KeyDiff<T>[] {
	const result = new Array<KeyDiff<T>>();
	for (const key in obj1) {
		if (key in obj2) {
			result.push({
				key,
				val1: (obj1 as any)[key],
				val2: (obj2 as any)[key],
			});
		} else {
			result.push({ key, val1: (obj1 as any)[key], val2: undefined });
		}
	}
	for (const key in obj2) {
		if (!(key in obj1)) {
			result.push({ key, val1: undefined, val2: (obj2 as any)[key] });
		}
	}

	return result;
}
