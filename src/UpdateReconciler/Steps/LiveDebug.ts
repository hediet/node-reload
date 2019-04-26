import { array, type, string, literal, union, Integer } from "io-ts";
import { contract, notificationContract } from "@hediet/typed-json-rpc";
import { StepExecutionController, StepState } from "./StepExecutionController";
import { Disposable, DisposableComponent } from "@hediet/std/disposable";
import { registerLiveDebug } from "@hediet/live-debug";

const stepState = type({
	id: string,
	state: union([
		literal("notRun"),
		literal("running"),
		literal("ran"),
		literal("undoing"),
		literal("undone"),
	]),
});

export const liveDebugContract = contract({
	server: {
		updateState: notificationContract({
			params: type({
				controllerId: Integer,
				newState: array(stepState),
			}),
		}),
	},
	client: {
		runToStepIncluding: notificationContract({
			params: type({
				stepId: string,
			}),
		}),
	},
});

export class LiveDebug {
	public static readonly instance = new LiveDebug();
	private controllerId = 0;
	private readonly controllers = new Map<number, StepExecutionController>();
	private readonly servers = new Set<{
		server: typeof liveDebugContract.TServerInterface;
	}>();

	constructor() {
		registerLiveDebug((channel, onClosed) => {
			const { server } = liveDebugContract.getServer(channel, {
				runToStepIncluding: ({ stepId }) => {
					this.runToStepIncluding(stepId);
				},
			});
			const info = { server };
			this.servers.add(info);
			onClosed.then(() => {
				this.servers.delete(info);
			});

			for (const [id, c] of this.controllers) {
				this.publishData(c.getStepStates(), id);
			}
		});
	}

	public registerController(controller: StepExecutionController): Disposable {
		return new DisposableComponent(track => {
			const controllerId = this.controllerId++;
			this.controllers.set(controllerId, controller);
			track({
				dispose: () => {
					this.controllers.delete(controllerId);
				},
			});
			track(
				controller.onStepStatesChanged.sub(state =>
					this.publishData(state, controllerId)
				)
			);
		});
	}

	private publishData(state: StepState[], controllerId: number): void {
		for (const server of this.servers) {
			server.server.updateState({
				controllerId,
				newState: state.map(s => ({
					id: s.id,
					state: s.state.kind,
				})),
			});
		}
	}

	public runToStepIncluding(stepId: string, controllerId?: number) {
		for (const [id, c] of this.controllers) {
			if (controllerId !== undefined && id !== controllerId) {
				continue;
			}
			c.moveTo(stepId);
		}
	}
}
