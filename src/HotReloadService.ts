import { watch } from "chokidar";
import { relative } from "path";
import { readFileSync } from "fs";
import Module = require("module");
import {
	UpdateReason,
	ReconcileContext,
	nodeModuleSourceProperty,
	nodeModuleReconcilerProperty,
} from "./Reconciler";

export class HotReloadService {
	public static instance: HotReloadService | undefined;

	private readonly watcher = watch([], { disableGlobbing: true });
	private readonly trackedModules = new Map<
		/* fileName */ string,
		ReconcilableNodeModule
	>();

	public log(...message: any[]) {
		if (this.loggingEnabled) {
			console.log(...message);
		}
	}

	public readonly originalModule = {
		load: Module.prototype.load,
		require: Module.prototype.require,
	};

	constructor(
		private readonly loggingEnabled: boolean,
		private readonly shouldTrackModule: (filename: string) => boolean
	) {
		this.watcher.on("change", (file: string) => {
			this.handleFileChanged(file);
		});

		const service = this;

		Module.prototype.require = function(
			this: NodeModule,
			request: string
		): any {
			return service.require(this, request);
		};

		Module.prototype.load = function(this: NodeModule, filename: string) {
			service.handleBeforeModuleLoaded(this, filename);
			const result = service.originalModule.load.call(this, filename);
			return result;
		};
	}

	public require(
		caller: NodeModule,
		request: string,
		callerTrackedModule?: ReconcilableModule
	): unknown {
		const moduleExports = this.originalModule.require.call(caller, request);

		try {
			const modulePath = Module._resolveFilename(request, caller);
			const requiredModule = require.cache[modulePath] as NodeModule;
			if (requiredModule) {
				if (!callerTrackedModule) {
					callerTrackedModule = this.trackedModules.get(
						caller.filename
					);
				}
				this.handleAfterModuleRequired(
					callerTrackedModule,
					requiredModule
				);
			}
		} catch (e) {
			this.log(
				`Error while requiring "${request}" from "${
					caller.filename
				}": `,
				e
			);
		}

		return moduleExports;
	}

	public trackEntryModule(mod: NodeModule) {
		if (this.trackedModules.get(mod.filename)) {
			return;
		}

		this.handleBeforeModuleLoaded(mod, mod.filename);
		this.handleAfterModuleRequired(undefined, mod);
	}

	private handleBeforeModuleLoaded(
		requiredModule: NodeModule,
		filename: string
	) {
		if (!this.shouldTrackModule(filename)) {
			return;
		}

		const source = readFileSync(filename, {
			encoding: "utf8",
		});
		nodeModuleSourceProperty.set(requiredModule, source);

		const trackedModule = new ReconcilableNodeModule(requiredModule, this);

		const oldTrackedModule = this.trackedModules.get(filename);
		if (oldTrackedModule) {
			if (oldTrackedModule.prepareNewModule) {
				oldTrackedModule.prepareNewModule(requiredModule);
			}
			this.log(`Existing module for file "${filename}" was overridden.`);
		}

		this.trackedModules.set(filename, trackedModule);
	}

	private handleAfterModuleRequired(
		dependant: ReconcilableModule | undefined,
		dependency: NodeModule
	) {
		let requiredTrackedModule = this.trackedModules.get(
			dependency.filename
		);
		if (!requiredTrackedModule) {
			this.log(`Required untracked module "${dependency.filename}"`);
		} else {
			if (dependant) {
				requiredTrackedModule.dependants.add(dependant);
				dependant.dependencies.add(requiredTrackedModule);
			}

			this.watcher.add(dependency.filename);
		}
	}

	private handleFileChanged(filename: string) {
		const changedModule = this.trackedModules.get(filename);
		if (!changedModule) {
			return;
		}

		this.log(
			`File changed: "${relative(
				process.cwd(),
				changedModule.module.filename
			)}"`
		);

		const mightNeedReconcilation = this.getModulesThatMightNeedReconcilation(
			changedModule
		);

		const processedDeps = new Map<
			ReconcilableModule,
			{ reconciled: boolean; reason: UpdateReason }
		>();
		const queue = [changedModule as ReconcilableModule];
		while (queue.length > 0) {
			const curMod = queue.shift()!;
			if (processedDeps.has(curMod)) {
				continue;
			}

			const possibleChangedDeps = [
				...curMod.dependencies.values(),
			].filter(d => mightNeedReconcilation.has(d));

			if (!possibleChangedDeps.every(d => processedDeps.has(d))) {
				// Process after all relevant deps have been processed.
				continue;
			}
			const notReconciledDeps = possibleChangedDeps.filter(
				d => !processedDeps.get(d)!.reconciled
			);
			const reason = this.getReason(
				curMod,
				changedModule,
				notReconciledDeps,
				processedDeps
			);
			const reconciled = this.tryToReconcile(reason, curMod);
			processedDeps.set(curMod, { reason, reconciled });

			for (const dependant of curMod.dependants) {
				queue.push(dependant);
			}
		}
	}

	private getReason(
		curMod: ReconcilableModule,
		changedModule: ReconcilableNodeModule,
		notReconciledDeps: ReconcilableModule[],
		processedDeps: ReadonlyMap<
			ReconcilableModule,
			{ reconciled: boolean; reason: UpdateReason }
		>
	): UpdateReason {
		const reason: UpdateReason = {
			dependencyUpdates: new Map(),
		};
		if (curMod === changedModule) {
			const newSource = readFileSync(changedModule.module.filename, {
				encoding: "utf8",
			});
			reason.moduleUpdates = {
				newSource,
				oldSource: nodeModuleSourceProperty.get(changedModule.module)!,
			};
		}
		for (const d of notReconciledDeps) {
			reason.dependencyUpdates.set(d.id, processedDeps.get(d)!.reason);
		}
		return reason;
	}

	private tryToReconcile(
		reason: UpdateReason,
		curMod: ReconcilableModule
	): boolean {
		if (reason.moduleUpdates || reason.dependencyUpdates.size > 0) {
			// something changed for this module
			this.log(`Reconciling ${curMod.id}:`);
			if (curMod.tryToReconcile(reason)) {
				this.log(`succeeded.`);
				return true;
			} else {
				if (curMod.dependants.size === 0) {
					this.log(`failed.`);
				}
				return false;
			}
		}
		return false;
	}

	private getModulesThatMightNeedReconcilation(
		changedModule: ReconcilableModule
	): Set<ReconcilableModule> {
		const mightNeedReconcilation = new Set<ReconcilableModule>();
		const queue = [changedModule];
		while (queue.length > 0) {
			const curMod = queue.shift()!;
			mightNeedReconcilation.add(curMod);

			for (const dependant of curMod.dependants) {
				if (mightNeedReconcilation.has(dependant)) {
					continue;
				}
				queue.push(dependant);
			}
		}
		return mightNeedReconcilation;
	}
}

abstract class ReconcilableModule {
	public dependencies = new Set<ReconcilableModule>();
	public dependants = new Set<ReconcilableModule>();
	public abstract get id(): string;

	public abstract tryToReconcile(reason: UpdateReason): boolean;
}

class ReconcilableNodeModule extends ReconcilableModule {
	public prepareNewModule:
		| ((module: NodeModule) => void)
		| undefined = undefined;

	constructor(
		public readonly module: NodeModule,
		private readonly service: HotReloadService
	) {
		super();
	}

	public get id(): string {
		return this.module.id;
	}

	public tryToReconcile(reason: UpdateReason): boolean {
		let reloaded = false;

		const clearOldCache = () => {
			if (!reloaded) {
				this.service.log(`... clearing cache`);
				delete require.cache[this.module.filename];
			}
			reloaded = true;
		};

		const reloadModule: ReconcileContext["reloadModule"] = prepareNewModule => {
			clearOldCache();
			// don't track this dependency to ourself
			this.service.log("... requiring new module");
			this.prepareNewModule = prepareNewModule;
			const newExports = this.service.originalModule.require.call(
				this.module,
				this.module.filename
			);
			this.prepareNewModule = undefined;
			const requiredModule = require.cache[
				this.module.filename
			] as NodeModule;
			return { newExports, newModule: requiredModule };
		};

		const reconciled = this.reconcile({
			...reason,
			reloadModule,
		});

		if (!reconciled) {
			clearOldCache();
		}
		return reconciled;
	}

	private reconcile(context: ReconcileContext): boolean {
		const r = nodeModuleReconcilerProperty.get(this.module);
		if (r) {
			return r(context);
		}
		return false;
	}
}

export class DelegateModule extends ReconcilableModule {
	public static idCounter = 0;

	private _id: number = DelegateModule.idCounter++;

	constructor(
		private readonly idPrefix: string,
		private readonly _reconciler: (reason: UpdateReason) => boolean
	) {
		super();
	}

	public get id(): string {
		return `${this.idPrefix}#${this._id}`;
	}

	public tryToReconcile(reason: UpdateReason): boolean {
		return this._reconciler(reason);
	}
}
