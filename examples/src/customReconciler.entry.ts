import { enableHotReload, setModuleReconciler } from "../../dist";

export let x = "";

enableHotReload({ loggingEnabled: false });

// Use `setModuleReconciler` to implement custom reconcilers.
// Do this only if the `UpdateReconciler` is not sufficient!
setModuleReconciler(module, ctx => {
	if (ctx.dependencyUpdates.size >= 0) {
		return false;
	}
	const e = ctx.reloadModule<typeof import("./customReconciler.entry")>();
	x = e.newExports.x;
	return true;
});
