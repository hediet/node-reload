import { DisposableLike, Disposable, dispose } from "@hediet/std/disposable";
import { HotReloadService, DelegateModule } from "./HotReloadService";

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
