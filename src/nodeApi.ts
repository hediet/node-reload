import Module = require("module");
import { IDisposable } from "./disposable";

const nodeJsModuleBrand = Symbol("NodeJsModule");

export interface NodeJsModule {
    [nodeJsModuleBrand]: true;
    filename: string;
    exports: any;
}

export function getLoadedModule(filename: string): NodeJsModule | undefined {
    return require.cache[filename] as any as NodeJsModule | undefined;
}

export function deleteModule(filename: string): boolean {
    if (!require.cache[filename]) {
        return false;
    }
    delete require.cache[filename];
    return true;
}

export function resolveFileName(request: string, caller: NodeJsModule) {
    return (Module as any)._resolveFilename(request, caller);
}

export function moduleFromNodeModule(nodeModule: NodeModule): NodeJsModule {
    return nodeModule as any as NodeJsModule;
}

export function registerModuleInterceptors(
    options: {
        interceptRequire: (module: NodeJsModule, request: string) => unknown;
        interceptLoad: (module: NodeJsModule, filename: string) => unknown;
    }
): {
    originalRequire: (module: NodeJsModule, request: string) => unknown;
    originalLoad: (module: NodeJsModule, filename: string) => unknown;
} & IDisposable {
    const originalModule = {
        load: Module.prototype.load,
        require: Module.prototype.require,
    };

    let disposed = false;

    const newRequire = Module.prototype.require = function (this: NodeModule, request: string): unknown {
        if (disposed) {
            return originalModule.require.call(this, request);
        }
        return options.interceptRequire(this as any as NodeJsModule, request);
    } as any;

    const newLoad = Module.prototype.load = function (this: NodeModule, filename: string): unknown {
        if (disposed) {
            return originalModule.load.call(this, filename);
        }
        return options.interceptLoad(this as any as NodeJsModule, filename);
    };

    return {
        originalRequire: (module, request) => originalModule.require.call(module, request),
        originalLoad: (module, filename) => originalModule.load.call(module as any as NodeModule, filename),
        dispose: () => {
            disposed = true;
            if (Module.prototype.require === newRequire) {
                Module.prototype.require = originalModule.require;
            }
            if (Module.prototype.load === newLoad) {
                Module.prototype.load = originalModule.load;
            }
        }
    };
}
