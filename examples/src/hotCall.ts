import {
	enableHotReload,
	registerUpdateReconciler,
	getReloadCount,
	hotCallExportedFunction,
	hotMethod,
} from "../../dist";

enableHotReload();
registerUpdateReconciler(module);

if (getReloadCount(module) === 0) {
	const result = hotCallExportedFunction(module, sqr, 5);
	console.log(`5 * 5 = ${result}`);
}

export function sqr(i: number): number {
	const result = i * i;
	return result;
}

class Test {
	constructor() {
		const result = this.sqr(10);
	}

	@hotMethod(module)
	public sqr(i: number): number {
		const result = i * 2;
		return result;
	}
}

new Test().sqr(10);
