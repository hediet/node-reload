import { startWebSocketServer } from "@hediet/typed-json-rpc-websocket-server";
import { debuggerConnectionContract } from "@hediet/node-reload";
import { DisposableComponent } from "@hediet/std/disposable";
import { EventEmitter } from "@hediet/std/events";

export interface StepState {
	id: string;
	state: "notRun" | "running" | "ran" | "undoing" | "undone";
}

export class Server extends DisposableComponent {
	static instance: Server = new Server();

	private readonly stepStatesChangedEmitter = new EventEmitter<StepState[]>();
	public readonly onStepStatesChanged = this.stepStatesChangedEmitter.asEvent();

	public readonly port: number;

	constructor() {
		super();
		const clients = new Set<{ state: StepState[] }>();
		const server = this.trackDisposable(
			startWebSocketServer({ port: 0 }, stream => {
				const clientState = { state: new Array<StepState>() };
				clients.add(clientState);
				debuggerConnectionContract.registerServerToStream(
					stream,
					undefined,
					{
						updateState: ({ newState }) => {
							clientState.state = newState;
							this.stepStatesChangedEmitter.emit(
								new Array<StepState>().concat(
									...[...clients].map(c => c.state)
								)
							);
						},
					}
				);
				stream.onClosed.then(() => {
					clients.delete(clientState);
					this.stepStatesChangedEmitter.emit(
						new Array<StepState>().concat(
							...[...clients].map(c => c.state)
						)
					);
				});
			})
		);

		this.port = server.port;
	}
}
