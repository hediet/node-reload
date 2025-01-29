
export interface IDisposable {
    dispose(): void;
}

export class DisposableStore implements IDisposable {
    private readonly _toDispose = new Set<IDisposable>();

    add<T extends IDisposable>(disposable: T): T {
        this._toDispose.add(disposable);
        return disposable;
    }

    dispose(): void {
        for (const disposable of this._toDispose) {
            disposable.dispose();
        }
        this._toDispose.clear();
    }
}
