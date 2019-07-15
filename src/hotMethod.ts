import { HotReloadService } from "./HotReloadService";

interface HotMethodOptions {
	//restartOnReload?: boolean;
}
const defaultHotMethodOptions: HotMethodOptions = {
	//restartOnReload: true
};

/**
 * Marks a class as hot reloadable.
 * This marks each method with `@hotMethod` and tracks new methods.
 */
export function hotClass(
	module: NodeModule,
	options = defaultHotMethodOptions
) {
	return function(target: any) {
		if (!HotReloadService.instance) {
			return;
		}

		FunctionStore.instance.addPrototype(
			module,
			target.name,
			target.prototype
		);

		for (const key of Object.getOwnPropertyNames(target.prototype)) {
			const d = Object.getOwnPropertyDescriptor(target.prototype, key);
			if (d && !d.value.isHot) {
				hotMethod(module, options)(target.prototype, key, d);
				Object.defineProperty(target.prototype, key, d);
			}
		}
	};
}

/**
 * Marks a method as hot reloadable.
 * If the method changes while it is executed, it will be restarted.
 * However, if an hot caller changes, it throws a `ModuleChangedError` exception.
 * This triggers the topmost changed caller to restart.
 * The decorator does nothing, if hot reloading has not been enabled.
 * Warning: This decorator might have an performance impact when hot reloading is enabled.
 */
export function hotMethod(
	module: NodeModule,
	options = defaultHotMethodOptions
) {
	return function(
		target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor
	) {
		if (!HotReloadService.instance) {
			return;
		}

		const func = descriptor.value;
		const className: string = target.constructor.name;

		FunctionStore.instance.setFunc(module, className, propertyKey, func);
		descriptor.value = getNewFunc(module, className, propertyKey);
	};
}

export class ModuleChangedError {
	constructor(public readonly frameToRestart: HotStackFrame) {}
}

/**
 * Checks whether any hot method has been changed.
 * If so, throws a `ModuleChangedError` exception that triggers a restart.
 */
export function restartOnReload() {
	if (!HotStack.instance.current || !HotReloadService.instance) {
		return;
	}

	if (
		HotReloadService.instance!.handleFileMightHaveChanged(
			HotStack.instance.current.module.filename
		)
	) {
		const b = HotStack.instance.findFrameToRestart();
		if (b) {
			throw new ModuleChangedError(b.frameToRestart);
		}
	}
}

function getNewFunc(module: NodeModule, className: string, methodName: string) {
	const fnName =
		methodName === "constructor"
			? `${className}`
			: `${methodName}@hot-wrapper`;
	const obj = {
		[fnName](this: any, ...args: any[]) {
			let result: any;

			while (true) {
				const mostRecentFunc = FunctionStore.instance.getFunc(
					module,
					className,
					methodName
				)!;
				const entry: HotStackFrame = {
					module,
					className,
					methodName,
					fn: mostRecentFunc,
				};
				HotStack.instance.push(entry);
				try {
					restartOnReload();
					result = mostRecentFunc.apply(this, args);
					restartOnReload();
					break;
				} catch (e) {
					if (e instanceof ModuleChangedError) {
						if (e.frameToRestart === entry) {
							HotReloadService.instance!.log(
								`Restarting ${e.frameToRestart.className}::${
									e.frameToRestart.methodName
								}(${args}).`,
								args
							);
							continue;
						} else {
							HotReloadService.instance!.log(
								`Interrupting ${entry.className}::${
									entry.methodName
								}(${args}) because a caller changed.`
							);
						}
					}
					throw e;
				} finally {
					HotStack.instance.pop();
				}
			}
			return result;
		},
	};
	(obj[fnName] as any).isHot = true;

	return obj[fnName];
}

class FunctionStore {
	public static instance = new FunctionStore();

	private readonly prototypes = new Map<string, any[]>();
	private readonly map = new Map<string, Function>();

	private getKey(
		module: NodeModule,
		className: string,
		methodName: string
	): string {
		return JSON.stringify({ mod: module.filename, className, methodName });
	}

	public addPrototype(module: NodeModule, className: string, newProto: any) {
		const key = JSON.stringify({ mod: module.filename, className });
		let oldProtos = this.prototypes.get(key);
		if (!oldProtos) {
			oldProtos = [];
			this.prototypes.set(key, oldProtos);
		}

		for (const oldProto of oldProtos) {
			for (const propName of Object.getOwnPropertyNames(newProto)) {
				if (!(propName in oldProto)) {
					oldProto[propName] = newProto[propName];
				}
			}
		}
		oldProtos.push(newProto);
	}

	public setFunc(
		module: NodeModule,
		className: string,
		methodName: string,
		fn: Function
	) {
		const key = this.getKey(module, className, methodName);
		this.map.set(key, fn);
	}

	public getFunc(
		module: NodeModule,
		className: string,
		methodName: string
	): Function | undefined {
		const key = this.getKey(module, className, methodName);
		return this.map.get(key);
	}
}

interface HotStackFrame {
	module: NodeModule;
	className: string;
	methodName: string;
	fn: Function;
}

class HotStack {
	public static instance = new HotStack();

	private readonly hotStack = new Array<HotStackFrame>();

	public push(entry: HotStackFrame) {
		this.hotStack.push(entry);
	}

	public pop() {
		this.hotStack.pop();
	}

	public get current(): HotStackFrame | undefined {
		if (this.hotStack.length === 0) {
			return undefined;
		}
		return this.hotStack[this.hotStack.length - 1];
	}

	public findFrameToRestart(): { frameToRestart: HotStackFrame } | undefined {
		for (const entry of this.hotStack) {
			const newFn = FunctionStore.instance.getFunc(
				entry.module,
				entry.className,
				entry.methodName
			);
			if (!newFn) {
				throw new Error("Cannot happen");
			}
			if (newFn.toString() !== entry.fn.toString()) {
				return { frameToRestart: entry };
			}
		}
		return undefined;
	}
}
