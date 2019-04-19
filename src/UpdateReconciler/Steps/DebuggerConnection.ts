import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";
import { array, type, string, literal, union, Integer } from "io-ts";
import { contract, notificationContract } from "@hediet/typed-json-rpc";
import { StepState } from "./steps";
import { Controller } from "./Controller";
import { Disposable, DisposableComponent } from "@hediet/std/disposable";

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

export type SimpleStepState = typeof stepState["_A"];

export const stepsContract = contract({
	server: {
		updateState: notificationContract({
			params: type({
				controllerId: Integer,
				newState: array(stepState),
			}),
		}),
	},
	client: {},
});

export class DebuggerConnection {
	public static readonly instance = new DebuggerConnection();
	private controllerId = 0;
	private readonly controllers = new Map<number, Controller>();
	private readonly servers = new Set<{
		server: typeof stepsContract.TServerInterface;
		stream: WebSocketStream;
	}>();

	public registerController(controller: Controller): Disposable {
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

	public async connectTo(serverPort: number) {
		const stream = await WebSocketStream.connectTo({
			host: "localhost",
			port: serverPort,
		});
		const { server } = stepsContract.getServerFromStream(
			stream,
			undefined,
			{}
		);
		const info = { server, stream };
		this.servers.add(info);
		stream.onClosed.then(() => {
			this.servers.delete(info);
		});

		for (const [id, c] of this.controllers) {
			this.publishData(c.getStepStates(), id);
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