import {
    getReloadCount,
    useExportedItemAndUpdateOnReload
} from "./updateReconciler";

export interface Step<A = unknown, B = unknown> {
    id: string;
    do: (args: A) => Promise<{ result: B; undo?: () => Promise<unknown> } | B>;
}

export interface Steps<D1 = unknown, D2 = unknown> {
    steps: Step<unknown, unknown>[];
}

export function steps<D1, D2, D3, D4, D5, D6, D7>(
    step1: Step<D1, D2>,
    step2?: Step<D2, D3>,
    step3?: Step<D3, D4>,
    step4?: Step<D4, D5>,
    step5?: Step<D5, D6>,
    step6?: Step<D6, D7>
): Steps<D1, D6> {
    return {
        steps: [step1, step2, step3, step4, step5, step6].filter(
            s => s != undefined
        ) as Step[]
    };
}

export interface StepData {
    step: Step;
    processed: boolean;
    result: { undo?: () => void; result: unknown } | undefined;
}

export class Controller<TIn, TOut> {
    private lastRanStepIdx: number = -1;
    private steps = new Array<StepData>();

    public async applyNewSteps(steps: Steps<TIn, TOut>): Promise<void> {
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
                    result: this.steps[i].result
                };
            } else {
                return {
                    step,
                    processed: false,
                    result: undefined
                };
            }
        });

        while (this.lastRanStepIdx < lastChangedIdx) {
            const nextStep = this.steps[this.lastRanStepIdx + 1];
            let arg = undefined;
            if (this.lastRanStepIdx > 0) {
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
            Math.min(lastChangedIdx, steps.steps.length - 1)
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
        const controller = new Controller<void, void>();
        useExportedItemAndUpdateOnReload(module, builder, builder => {
            controller.applyNewSteps(builder());
        });
    }
}
