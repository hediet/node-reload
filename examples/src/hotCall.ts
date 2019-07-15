import {
	enableHotReload,
	registerUpdateReconciler,
	getReloadCount,
	hotClass,
} from "../../dist";
import { disableHotReload } from "../../dist/enableHotReload";

enableHotReload();
registerUpdateReconciler(module);

@hotClass(module)
class Test {
	public main(): void {
		console.log("main");
		const r = this.max(10, 14);
		console.log("max is: ", r);
	}

	private max(m: number, n: number): number {
		console.log(`Compute max(${m}, ${n})`);
		let result = m > n ? m : n;
		console.log(`Result is: `, result);
		return result;
	}
}

if (getReloadCount(module) === 0) {
	new Test().main();
	disableHotReload();
}
