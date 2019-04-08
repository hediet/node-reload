export let x = "";

module.reconciler = ctx => {
    if (ctx.dependencyUpdates.size >= 0) {
        return false;
    }
    const e = ctx.reloadModule<typeof import("./manualReconciler")>();
    x = e.newExports.x;
    return true;
};
