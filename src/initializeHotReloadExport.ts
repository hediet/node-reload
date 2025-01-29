import { moduleSource } from "./hotReloadExportedItem";
import { HotReloadService } from "./HotReloadService";

export function initializeHotReloadExport(service: HotReloadService): void {
    service.onTrackedModuleExportsLoaded(data => {
        if (typeof data.module.exports !== 'object') {
            return;
        }
        for (const [key, val] of Object.entries(data.module.exports)) {
            if ((typeof val === 'function' || typeof val === 'object') && val) {
                moduleSource.set(val, { module: data.module, exportName: key });
            }
        }
    });
}
