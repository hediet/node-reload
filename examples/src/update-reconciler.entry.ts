import {
	registerUpdateReconciler,
	hotRequireExportedFn,
	getReloadCount,
	enableHotReload,
} from "../../dist";

enableHotReload({ loggingEnabled: false });
registerUpdateReconciler(module);

export class Test {
	private id = "Test";
	constructor() {
		console.log(this.id + " created");
	}

	dispose() {
		console.log(this.id + " diposed");
	}
}

export function foo(arg: string) {
	console.log(arg + " change me");
}

// only cause side effect on initial load as the entire module is run again on each reload
if (getReloadCount(module) === 0) {
	hotRequireExportedFn(module, Test, { hasFnChanged: "useSource" }, Test => {
		return new Test();
	});

	let i = 0;
	hotRequireExportedFn(module, foo, { hasFnChanged: "useSource" }, foo => {
		foo("test" + i++);
	});
}
