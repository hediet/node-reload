import { HotReloadService } from "./HotReloadService";

export interface HotReloadOptions {
    entryModule?: NodeModule;
    loggingEnabled?: boolean;
    shouldTrack?: (filename: string) => boolean;
}

export function enableHotReload(options?: HotReloadOptions) {
    if (!HotReloadService.instance) {
        let shouldTrack = (filename: string) => {
            if (/node_modules/.exec(filename)) {
                return false;
            }
            return true;
        };
        if (options && options.shouldTrack) {
            shouldTrack = options.shouldTrack;
        }

        let loggingEnabled = false;
        if (options && options.loggingEnabled !== undefined) {
            loggingEnabled = options.loggingEnabled;
        }

        HotReloadService.instance = new HotReloadService(
            loggingEnabled,
            shouldTrack
        );
    }

    if (options && options.entryModule) {
        HotReloadService.instance.trackEntryModule(options.entryModule);
    } else if (process.mainModule) {
        HotReloadService.instance.trackEntryModule(process.mainModule);
    } else {
        throw new Error(
            "`process.mainModule` is not defined and no `entryModule` has been specified!"
        );
    }
}