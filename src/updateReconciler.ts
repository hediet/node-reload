import { Disposable, DisposableLike, dispose } from "@hediet/std/disposable";

class AttachedProperty<TTarget extends object, TValue> {
    private readonly sym = Symbol();

    constructor(private readonly defaultValueCtor: () => TValue) {}

    public get(target: TTarget): TValue {
        if (!(this.sym in target)) {
            (target as any)[this.sym] = this.defaultValueCtor();
        }
        return (target as any)[this.sym];
    }

    public set(target: TTarget, value: TValue) {
        (target as any)[this.sym] = value;
    }
}

interface ModuleInfo {
    updaters: Set<Updater>;
    disposables: Disposable[];
    reloadCount: number;
}

interface Updater {
    update: (current: any, old: any | undefined) => DisposableLike | void;
    exportName: string;
    lastDisposable: DisposableLike;
}

const moduleInfoProperty = new AttachedProperty<NodeModule, ModuleInfo>(() => ({
    reloadCount: 0,
    updaters: new Set<Updater>(),
    disposables: []
}));

export function installUpdateReconciler(mod: NodeModule) {
    mod.reconciler = ctx => {
        const info = moduleInfoProperty.get(mod);
        const curUpdaters = [...info.updaters];

        dispose(info.disposables);

        const { newExports } = ctx.reloadModule(newModule => {
            const newInfo = moduleInfoProperty.get(newModule);
            newInfo.reloadCount = info.reloadCount + 1;
            newInfo.updaters = info.updaters;
        });

        for (const updater of curUpdaters) {
            const newVal = newExports[updater.exportName];
            dispose(updater.lastDisposable);
            updater.lastDisposable = updater.update(newVal, undefined) as any;
        }

        return true;
    };
}

export function getReloadCount(mod: NodeModule): number {
    return moduleInfoProperty.get(mod).reloadCount;
}

export function disposeOnReload(mod: NodeModule, disposable: Disposable) {
    moduleInfoProperty.get(mod).disposables.push(disposable);
}

export function useExportedItemAndUpdateOnReload<TItem extends Function>(
    caller: NodeModule,
    item: TItem,
    update: (current: TItem, old: TItem | undefined) => DisposableLike | void
): Disposable {
    const updater: Updater = {
        exportName: item.name,
        lastDisposable: update(item, undefined) as any,
        update
    };

    moduleInfoProperty.get(caller).updaters.add(updater);

    return Disposable.create(() => {
        moduleInfoProperty.get(caller).updaters.delete(updater);
        dispose(updater.lastDisposable);
    });
}
