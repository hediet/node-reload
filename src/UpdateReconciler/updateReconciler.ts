import { Disposable, DisposableLike, dispose } from "@hediet/std/disposable";
import { AttachedProperty } from "@hediet/std/extensibility";
import { nodeModuleReconcilerProperty } from "../Reconciler";

interface ModuleInfo {
	updaters: Set<Updater>;
	disposables: Disposable[];
	reloadCount: number;
}

interface Updater {
	update: HotRequireExportedFnUpdater<Function>;
	exportName: string;
	lastDisposable: DisposableLike;
	hasFnChanged: (newFn: Function, lastFn: Function) => boolean;
	lastFn: Function;
}

const moduleInfoProperty = new AttachedProperty<NodeModule, ModuleInfo>(() => ({
	reloadCount: 0,
	updaters: new Set<Updater>(),
	disposables: [],
}));

export function registerUpdateReconciler(module: NodeModule) {
	nodeModuleReconcilerProperty.set(module, ctx => {
		const info = moduleInfoProperty.get(module);
		const curUpdaters = [...info.updaters];

		dispose(info.disposables);

		const { newExports } = ctx.reloadModule(newModule => {
			const newInfo = moduleInfoProperty.get(newModule);
			newInfo.reloadCount = info.reloadCount + 1;
			newInfo.updaters = info.updaters;
		});

		for (const updater of curUpdaters) {
			const newFn = newExports[updater.exportName];
			if (!updater.hasFnChanged(newFn, updater.lastFn)) {
				continue;
			}
			dispose(updater.lastDisposable);
			updater.lastDisposable = updater.update(newFn, updater.lastFn);
			updater.lastFn = newFn;
		}

		return true;
	});
}

export function getReloadCount(mod: NodeModule): number {
	return moduleInfoProperty.get(mod).reloadCount;
}

export function disposeOnReload(mod: NodeModule, disposable: DisposableLike) {
	moduleInfoProperty
		.get(mod)
		.disposables.push(...Disposable.normalize(disposable));
}

export interface HotRequireExportedFnOptions {
	hasFnChanged?:
		| "yes"
		| "useSource"
		| ((newFn: Function, lastFn: Function) => boolean);
}

export type HotRequireExportedFnUpdater<TItem extends Function> = (
	current: TItem,
	old: TItem | undefined
) => DisposableLike | void;

export function hotRequireExportedFn<TItem extends Function>(
	module: NodeModule,
	fn: TItem,
	update: HotRequireExportedFnUpdater<TItem>
): Disposable;
export function hotRequireExportedFn<TItem extends Function>(
	module: NodeModule,
	fn: TItem,
	options: HotRequireExportedFnOptions,
	update: HotRequireExportedFnUpdater<TItem>
): Disposable;
export function hotRequireExportedFn(
	module: NodeModule,
	fn: Function,
	updateOrOptions:
		| HotRequireExportedFnOptions
		| HotRequireExportedFnUpdater<Function>,
	optionalUpdate?: HotRequireExportedFnUpdater<Function>
): Disposable {
	let options: HotRequireExportedFnOptions = {};
	let update: HotRequireExportedFnUpdater<Function>;
	if (typeof updateOrOptions === "function") {
		update = updateOrOptions;
	} else {
		options = updateOrOptions;
		update = optionalUpdate!;
	}

	let hasFnChanged: (newFn: Function, lastFn: Function) => boolean = () =>
		true;
	if (options) {
		if (options.hasFnChanged === "useSource") {
			hasFnChanged = (newFn, lastFn) =>
				newFn.toString() !== lastFn.toString();
		} else if (typeof options.hasFnChanged === "function") {
			hasFnChanged = options.hasFnChanged;
		}
	}
	const updater: Updater = {
		exportName: fn.name,
		lastDisposable: update(fn, undefined) as any,
		lastFn: fn,
		hasFnChanged,
		update,
	};

	moduleInfoProperty.get(module).updaters.add(updater);

	return Disposable.create(() => {
		moduleInfoProperty.get(module).updaters.delete(updater);
		dispose(updater.lastDisposable);
	});
}
