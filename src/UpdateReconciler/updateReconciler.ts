import { Disposable, DisposableLike, dispose } from "@hediet/std/disposable";
import { AttachedProperty } from "@hediet/std/extensibility";
import { setModuleReconciler } from "../Reconciler";
import { HotReloadService } from "../HotReloadService";

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

const moduleInfoProperty = new AttachedProperty<
	NodeModule,
	ModuleInfo | undefined
>(() => undefined);

/**
 * Registers the `UpdateReconciler` for the given module.
 * If the module changes after registration,
 * it disposes all disposables registered by `disposeOnReload`
 * and updates all `hotRequireExportedFn`-handlers.
 */
export function registerUpdateReconciler(module: NodeModule) {
	if (!moduleInfoProperty.get(module)) {
		moduleInfoProperty.set(module, {
			reloadCount: 0,
			updaters: new Set<Updater>(),
			disposables: [],
		});
	}
	setModuleReconciler(module, context => {
		const info = moduleInfoProperty.get(module);
		if (!info) {
			throw new Error("Impossible");
		}
		const curUpdaters = [...info.updaters];

		dispose(info.disposables);

		const { newExports } = context.reloadModule(newModule => {
			if (moduleInfoProperty.get(newModule)) {
				throw new Error("Impossible");
			}
			const newInfo: ModuleInfo = {
				reloadCount: info.reloadCount + 1,
				updaters: info.updaters,
				disposables: [],
			};
			moduleInfoProperty.set(newModule, newInfo);
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

/**
 * Gets the count of how often the given module was reconciled using the `UpdateReconciler`.
 */
export function getReloadCount(module: NodeModule): number {
	const info = moduleInfoProperty.get(module);
	if (!info) {
		throw new Error(`'registerUpdateReconciler' must be called first.`);
	}
	return info.reloadCount;
}

/**
 * Disposes `disposable` when `module` is reconciled by the `UpdateReconciler`.
 */
export function disposeOnReload(
	module: NodeModule,
	disposable: DisposableLike
) {
	const info = moduleInfoProperty.get(module);
	if (!info) {
		throw new Error(`'registerUpdateReconciler' must be called first.`);
	}
	info.disposables.push(...Disposable.normalize(disposable));
}

export interface HotRequireExportedFnOptions {
	/**
	 * Specify how changes are detected.
	 * `"yes"`: Consider every reload as change.
	 * `"useSource"`: Use `Function.toString()` to compare the functions source.
	 * `Function`: Use a custom test whether a function has changed.
	 */
	hasFnChanged?:
		| "yes"
		| "useSource"
		| ((newFn: Function, lastFn: Function) => boolean);
}

export type HotRequireExportedFnUpdater<TItem extends Function> = (
	current: TItem,
	old: TItem | undefined
) => DisposableLike | void;

/**
 * Uses an item that is exported in the given module.
 * It is important that `fn.name` reflects the name of the export.
 * `update` is called initially and whenever the given module reloads.
 */
export function hotRequireExportedFn<TItem extends Function>(
	module: NodeModule,
	fn: TItem,
	update: HotRequireExportedFnUpdater<TItem>
): Disposable;
/**
 * Uses an item that is exported in the given module.
 * It is important that `fn.name` reflects the name of the export.
 * `update` is called initially and whenever the given module reloads.
 */
export function hotRequireExportedFn<TItem extends Function>(
	module: NodeModule,
	fn: TItem,
	options: HotRequireExportedFnOptions,
	update: HotRequireExportedFnUpdater<TItem>
): Disposable;
export function hotRequireExportedFn(
	module: NodeModule,
	exportedFn: Function,
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

	const info = moduleInfoProperty.get(module);
	if (!info) {
		throw new Error(`'registerUpdateReconciler' must be called first.`);
	}

	/*
	// Don't throw as exports might be set later on initial load!
	if (module.exports[exportedFn.name] !== exportedFn) {
		throw new Error(
			`Given function is not exported at "module.exports.${
				exportedFn.name
			}"!`
		);
	}
	*/

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
		exportName: exportedFn.name,
		lastDisposable: update(exportedFn, undefined) as any,
		lastFn: exportedFn,
		hasFnChanged,
		update,
	};

	info.updaters.add(updater);

	return Disposable.create(() => {
		info.updaters.delete(updater);
		dispose(updater.lastDisposable);
	});
}

export function hotCallExportedFunction<TArgs extends any[], TResult>(
	module: NodeModule,
	exportedFn: (...args: TArgs) => TResult,
	...args: TArgs
): TResult {
	let result: any = undefined;
	const d = hotRequireExportedFn(module, exportedFn, exportedFn => {
		result = exportedFn(...args);
	});
	while (true) {
		if (HotReloadService.instance) {
			if (
				HotReloadService.instance.handleFileMightHaveChanged(
					module.filename
				)
			) {
				continue;
			}
		}
		break;
	}

	d.dispose();
	return result;
}
