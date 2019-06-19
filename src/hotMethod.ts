import { HotReloadService } from "./HotReloadService";

class FunctionStore {
	public static instance = new FunctionStore();

	private readonly map = new Map<string, Function>();

	private format(
		module: NodeModule,
		className: string,
		methodName: string
	): string {
		return JSON.stringify({ mod: module.filename, className, methodName });
	}

	public setFunc(
		module: NodeModule,
		className: string,
		methodName: string,
		fn: Function
	) {
		const key = this.format(module, className, methodName);
		this.map.set(key, fn);
	}

	public getFunc(
		module: NodeModule,
		className: string,
		methodName: string
	): Function | undefined {
		const key = this.format(module, className, methodName);
		return this.map.get(key);
	}
}

export function hotMethod(
	module: NodeModule,
	options: { restartOnReload?: boolean } = { restartOnReload: true }
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
		descriptor.value = getNewFunc(
			module,
			className,
			propertyKey,
			!!options.restartOnReload
		);
	};
}

function getNewFunc(
	module: NodeModule,
	className: string,
	methodName: string,
	restartOnReload: boolean
) {
	return function(this: any, ...args: any[]) {
		let result: any;
		while (true) {
			const mostRecentFunc = FunctionStore.instance.getFunc(
				module,
				className,
				methodName
			)!;
			result = mostRecentFunc.apply(this, args);

			if (
				restartOnReload &&
				HotReloadService.instance!.handleFileMightHaveChanged(
					module.filename
				)
			) {
				continue;
			}

			break;
		}
		return result;
	};
}
