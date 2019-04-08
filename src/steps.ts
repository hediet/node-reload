import {
    getReloadCount,
    useExportedItemAndUpdateOnReload,
} from "./updateReconciler";

export interface Step<A = unknown, B = unknown> {
    id: string;
    do: (args: A) => Promise<{ result: B; undo?: () => Promise<unknown> } | B>;
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
    processed: boolean;
    result: { undo?: () => void; result: unknown } | undefined;
}

export class Controller {
    private lastRanStepIdx: number = -1;
    private steps = new Array<StepData>();

    public async applyNewSteps(steps: Steps): Promise<void> {
        const [firstChangedIdx, lastChangedIdx] = this.findChangedIndices(
            steps
        );
        console.log("first: ", firstChangedIdx, "last: ", lastChangedIdx);

        if (firstChangedIdx > lastChangedIdx) {
            return;
        }

        while (this.lastRanStepIdx >= firstChangedIdx) {
            const r = this.steps[this.lastRanStepIdx].result;
            if (r) {
                if (r.undo) {
                    r.undo();
                }
            } else {
                throw new Error("Should not happen");
            }
            this.lastRanStepIdx--;
        }

        this.steps = steps.steps.map((step, i) => {
            if (i < firstChangedIdx) {
                return {
                    step,
                    processed: true,
                    result: this.steps[i].result,
                };
            } else {
                return {
                    step,
                    processed: false,
                    result: undefined,
                };
            }
        });

        while (this.lastRanStepIdx < lastChangedIdx) {
            const nextStep = this.steps[this.lastRanStepIdx + 1];
            let arg = undefined;
            if (this.lastRanStepIdx >= 0) {
                arg = this.steps[this.lastRanStepIdx].result!.result;
            }
            let result: any = await nextStep.step.do(arg);
            if (!("result" in result)) {
                result = { result, undo: () => {} };
            }
            nextStep.result = result;
            this.lastRanStepIdx++;
        }
    }

    private findChangedIndices(steps: Steps): [number, number] {
        let firstChangedIdx;
        for (
            firstChangedIdx = 0;
            firstChangedIdx < steps.steps.length;
            firstChangedIdx++
        ) {
            const oldStep = this.steps[firstChangedIdx];
            const newStep = steps.steps[firstChangedIdx];
            if (!oldStep) {
                break;
            }
            if (!this.areEqual(oldStep.step, newStep)) {
                break;
            }
        }

        let lastChangedIdx;
        for (
            lastChangedIdx = Math.max(
                steps.steps.length - 1,
                this.steps.length - 1
            );
            lastChangedIdx > 0;
            lastChangedIdx--
        ) {
            const oldStep = this.steps[lastChangedIdx];
            const newStep = steps.steps[lastChangedIdx];
            if (!oldStep) {
                break;
            }
            if (!this.areEqual(oldStep.step, newStep)) {
                break;
            }
        }

        return [
            firstChangedIdx,
            Math.min(lastChangedIdx, steps.steps.length - 1),
        ];
    }

    private areEqual(step1: Step, step2: Step): boolean {
        if (step1.id !== step2.id) {
            return false;
        }

        if (step1.do.toString() !== step2.do.toString()) {
            return false;
        }

        return true;
    }
}

export function setupControllerForExportedBuilder(
    module: NodeModule,
    builder: () => Steps
) {
    if (getReloadCount(module) === 0) {
        const controller = new Controller();
        useExportedItemAndUpdateOnReload(module, builder, builder => {
            controller.applyNewSteps(builder());
        });
    }
}
