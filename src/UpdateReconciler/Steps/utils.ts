export function areEqualConsideringFunctionSource(
	o1: unknown,
	o2: unknown
): boolean {
	if (typeof o1 === "function" && typeof o2 === "function") {
		return o1.toString() === o2.toString();
	}

	if (typeof o1 === "object" && typeof o2 === "object") {
		if (o1 === null) {
			return o2 === null;
		}
		if (o2 === null) {
			return false;
		}
		for (const entry of diffObjectsKeys(o1, o2)) {
			if (!areEqualConsideringFunctionSource(entry.val1, entry.val2)) {
				return false;
			}
		}
		return true;
	}

	if (Array.isArray(o1) && Array.isArray(o2)) {
		if (o1.length !== o2.length) {
			return false;
		}
		for (let i = 0; i < o1.length; i++) {
			if (!areEqualConsideringFunctionSource(o1[i], o2[i])) {
				return false;
			}
		}
		return false;
	}

	return o1 == o2;
}

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
