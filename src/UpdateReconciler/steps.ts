import { getReloadCount, hotRequireExportedFn } from "./updateReconciler";

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
	result: { undos: (() => Promise<void>)[]; result: unknown } | undefined;
}

export class Controller {
	private lastRanStepIdx: number = -1;
	private steps = new Array<StepData>();

	public async applyNewSteps(steps: Steps): Promise<void> {
		const { unchangedCountStart, unchangedCountEnd } = this.compare(steps);

		/*
		console.log(
			"unchanged front: ",
			unchangedCountStart,
			"unchanged end: ",
			unchangedCountEnd
        );
        */

		await this.moveBefore(unchangedCountStart);

		this.steps = steps.steps.map((step, i) => ({
			step,
			result: i < unchangedCountStart ? this.steps[i].result : undefined,
		}));

		await this.moveAfter(this.steps.length - 1 - unchangedCountEnd);
	}

	private async moveAfter(stepIdx: number): Promise<void> {
		while (this.lastRanStepIdx < stepIdx) {
			const nextStep = this.steps[this.lastRanStepIdx + 1];
			let arg = undefined;
			if (this.lastRanStepIdx >= 0) {
				arg = this.steps[this.lastRanStepIdx].result!.result;
			}
			const undos = new Array<() => Promise<void>>();
			const result = await nextStep.step.do(arg, {
				onUndo: fn => undos.push(fn),
			});
			nextStep.result = { result, undos };
			this.lastRanStepIdx++;
		}
	}

	private async moveBefore(stepIdx: number): Promise<void> {
		while (this.lastRanStepIdx >= stepIdx) {
			const stepData = this.steps[this.lastRanStepIdx];
			const r = stepData.result;
			if (!r) {
				throw new Error("Should not happen");
			}
			r.undos.reverse();
			for (const undo of r.undos) {
				await undo();
			}
			stepData.result = undefined;
			this.lastRanStepIdx--;
		}
	}

	private compare(
		steps: Steps
	): { unchangedCountStart: number; unchangedCountEnd: number } {
		const areEqual = (
			s1: StepData | undefined,
			s2: Step | undefined
		): boolean => {
			if (s1 === s2) {
				return true;
			}
			if (!s1 || !s2) {
				return false;
			}
			return this.areEqual(s1.step, s2);
		};

		const stepsArr = steps.steps;
		const stepsLen = stepsArr.length;

		let unchangedCountStart = 0;
		for (let i = 0; i < stepsLen; i++) {
			if (!areEqual(this.steps[i], stepsArr[i])) {
				break;
			}
			unchangedCountStart++;
		}

		let unchangedCountEnd = 0;
		for (let i = 1; i <= stepsLen; i++) {
			if (
				!areEqual(
					this.steps[this.steps.length - i],
					stepsArr[stepsLen - i]
				)
			) {
				break;
			}
			unchangedCountEnd++;
		}

		return { unchangedCountStart, unchangedCountEnd };
	}

	private areEqual(o1: unknown, o2: unknown): boolean {
		if (typeof o1 === "function" && typeof o2 === "function") {
			return o1.toString() === o2.toString();
		}
		if (typeof o1 === "object" && typeof o2 === "object") {
			if (o1 === null) {
				return o2 === null;
			}
			if (o2 === null) {
				return false;
			}
			for (const entry of diffObjectsKeys(o1, o2)) {
				if (!this.areEqual(entry.val1, entry.val2)) {
					return false;
				}
			}
			return true;
		}
		if (Array.isArray(o1) && Array.isArray(o2)) {
			if (o1.length !== o2.length) {
				return false;
			}

			for (let i = 0; i < o1.length; i++) {
				if (!this.areEqual(o1[i], o2[i])) {
					return false;
				}
			}
			return false;
		}

		return o1 == o2;
	}
}

type DiffTuple<T1, T2> = { key: string; val1: T1; val2: T2 };
type KeyDiff<T> =
	| DiffTuple<T, T>
	| DiffTuple<T, undefined>
	| DiffTuple<undefined, T>;
function diffObjectsKeys<T>(obj1: object, obj2: object): KeyDiff<T>[] {
	const result = new Array<KeyDiff<T>>();
	for (const key in obj1) {
		if (key in obj2) {
			result.push({
				key,
				val1: (obj1 as any)[key],
				val2: (obj2 as any)[key],
			});
		} else {
			result.push({ key, val1: (obj1 as any)[key], val2: undefined });
		}
	}
	for (const key in obj2) {
		if (!(key in obj1)) {
			result.push({ key, val1: undefined, val2: (obj2 as any)[key] });
		}
	}

	return result;
}

export function runExportedSteps(module: NodeModule, factory: () => Steps) {
	if (getReloadCount(module) === 0) {
		const controller = new Controller();
		hotRequireExportedFn(module, factory, factory => {
			controller.applyNewSteps(factory());
		});
	}
}