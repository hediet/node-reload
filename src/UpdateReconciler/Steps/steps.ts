import { getReloadCount, hotRequireExportedFn } from "../updateReconciler";
import { Controller } from "./Controller";
import { DebuggerConnection } from "./DebuggerConnection";

export interface StepContext {
	onUndo(undoFn: () => Promise<any>): void;
}

export interface Step<A = unknown, B = unknown> {
	id: string;
	uses?: unknown;
	do: (args: A, context: StepContext) => Promise<B>;
}

export interface Steps {
	steps: Step<unknown, unknown>[];
}

export function steps<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
	step0: Step<{}, T1>,
	step1: Step<T1, T2>,
	step2?: Step<T2, T3>,
	step3?: Step<T3, T4>,
	step4?: Step<T4, T5>,
	step5?: Step<T5, T6>,
	step6?: Step<T6, T7>,
	step7?: Step<T7, T8>,
	step8?: Step<T8, T9>,
	step9?: Step<T9, unknown>
): Steps {
	return {
		steps: [
			step0,
			step1,
			step2,
			step3,
			step4,
			step5,
			step6,
			step7,
			step8,
			step9,
		].filter(s => s != undefined) as Step[],
	};
}

export interface StepData {
	step: Step;
	state:
		| { kind: "ran"; undos: (() => Promise<void>)[]; result: unknown }
		| { kind: "running" }
		| { kind: "notRun" }
		| { kind: "undone" }
		| { kind: "undoing" };
}

export interface StepState {
	id: string;
	state:
		| { kind: "ran"; result: unknown }
		| { kind: "running" }
		| { kind: "notRun" }
		| { kind: "undone" }
		| { kind: "undoing" };
}

export function runExportedSteps(module: NodeModule, factory: () => Steps) {
	if (getReloadCount(module) === 0) {
		const controller = new Controller();
		DebuggerConnection.instance.registerController(controller);

		hotRequireExportedFn(module, factory, factory => {
			controller.applyNewSteps(factory());
		});
	}
}
