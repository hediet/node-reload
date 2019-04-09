import { enableHotReload, nodeModuleReconcilerProperty } from "../../dist";

export let x = "";

enableHotReload({ loggingEnabled: false });

// Use `nodeModuleReconcilerProperty` to implement custom reconcilers.
// Do this only if the `UpdateReconciler` is not sufficient!
nodeModuleReconcilerProperty.set(module, ctx => {
	if (ctx.dependencyUpdates.size >= 0) {
		return false;
	}
	const e = ctx.reloadModule<typeof import("./customReconciler.entry")>();
	x = e.newExports.x;
	return true;
});
