import {
	enableHotReload,
	registerUpdateReconciler,
	getReloadCount,
	hotCallExportedFunction,
	hotMethod,
	restartOnReload,
	hotClass,
} from "../../dist";
import { disableHotReload } from "../../dist/enableHotReload";

enableHotReload();
registerUpdateReconciler(module);

export function sqr(i: number): number {
	const result = i * i;
	return result;
}

@hotClass(module)
class Test {
	@hotMethod(module)
	public sqr(i: number): number {
		console.log("sql a");
		return i + this.p1(i * 2);
	}

	private p1(n: number): number {
		console.log("p1");
		debugger;
		return n + 2;
	}
}

if (getReloadCount(module) === 0) {
	const result = hotCallExportedFunction(module, sqr, 5);
	console.log(`5 * 5 = ${result}`);

	new Test().sqr(10);
	disableHotReload();
}
