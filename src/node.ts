import Module = require("module");
import { HotReloadService } from "./HotReloadService";
import { initializeHotReloadExport } from "./initializeHotReloadExport";

export interface HotReloadOptions {
	/**
	 * Use "module"
	 */
	entryModule: Module,
	logging?: boolean | 'info' | 'trace' | 'debug',
	loggingFileRoot?: string;
	/** A list of regular expressions. */
	ignoredModules?: string[];
	skipInitializationIfEnabled?: boolean;
}

export function hotReloadEnabled(): boolean {
	return HotReloadService.instance !== undefined;
}

export function enableHotReload(options: HotReloadOptions): void {
	HotReloadService.initialize(options);
	initializeHotReloadExport(HotReloadService.instance!);
}
