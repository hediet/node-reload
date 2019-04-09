import { DisposableLike, Disposable, dispose } from "@hediet/std/disposable";
import { HotReloadService, DelegateModule } from "./HotReloadService";

/**
 * Requires the module `request` (as in `require(request)`) and calls `loader` with the result.
 * If the required module reloads, the callback is called with the new module.
 * Returned disposables of previous invocations are disposed.
 * Use the returned disposable to stop watching for reloadings and disposing the last returned disposable.
 */
export function hotRequire<TModule>(
	caller: NodeModule,
	request: string,
	loader: (
		current: TModule,
		old: TModule | undefined
	) => DisposableLike | void
): Disposable {
	if (!HotReloadService.instance) {
		const result = caller.require(request);
		loader(result, undefined);
		return Disposable.empty;
	}

	let lastDisposable: DisposableLike;
	const hotRequireModule = new DelegateModule("hotRequire", reason => {
		const old = lastExports;
		lastExports = HotReloadService.instance!.require(
			caller,
			request,
			hotRequireModule
		) as TModule;

		dispose(lastDisposable);
		lastDisposable = loader(lastExports, old) as DisposableLike;
		return true;
	});
	let lastExports = HotReloadService.instance.require(
		caller,
		request,
		hotRequireModule
	) as TModule;

	lastDisposable = loader(lastExports, undefined) as DisposableLike;

	return Disposable.create(() => {
		// delete the hot require module from all dependant sets
		for (const dep of hotRequireModule.dependencies) {
			dep.dependants.delete(hotRequireModule);
		}
		dispose(lastDisposable);
	});
}
