import type { IDisposable } from "./disposable";
import type { TrackedModule } from "./HotReloadService";

export const moduleSource = new WeakMap<object | Function, { module: TrackedModule, exportName: string }>();

export function hotReloadExportedItem<T>(exportedItem: T, handleExportedItem: (exportedItem: T) => IDisposable | undefined): IDisposable {
    const source = moduleSource.get(exportedItem as object | Function);
    if (!source) {
        const v = handleExportedItem(exportedItem);
        return { dispose: () => { v?.dispose(); } };
    }

    let curDisposable = handleExportedItem(exportedItem);

    const updateStrategy = source.module.registerUpdateStrategy({
        applyUpdate: _changeInfo => {
            source.module.reload();
            const newValue = source.module.exports[source.exportName] as any;
            curDisposable?.dispose();
            curDisposable = handleExportedItem(newValue);
            return true;
        }
    });

    return {
        dispose: () => {
            curDisposable?.dispose();
            updateStrategy.dispose();
        }
    };
}
