import {
	enableHotReload,
	registerUpdateReconciler,
	getReloadCount,
	hotCallExportedFunction,
} from "../../dist";

enableHotReload();
registerUpdateReconciler(module);

require("C:\\Users\\Henning\\AppData\\Local\\Yarn\\Data\\global\\node_modules\\easy-attach\\")();

if (getReloadCount(module) === 0) {
	const result = hotCallExportedFunction(module, sqr, 5);
	console.log(`5 * 5 = ${result}`);
}

export function sqr(i: number): number {
	const result = i * i;
	return result;
}
