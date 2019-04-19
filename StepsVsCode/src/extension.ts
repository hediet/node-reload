import {
	enableHotReload,
	hotRequireExportedFn,
	registerUpdateReconciler,
	getReloadCount,
} from "@hediet/node-reload";
import { DisposableComponent } from "@hediet/std/disposable";
import { wait } from "@hediet/std/timer";
import * as vscode from "vscode";
import { Server } from "./server";

enableHotReload({ entryModule: module });
registerUpdateReconciler(module);

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		hotRequireExportedFn(module, Extension, Extension => new Extension())
	);
}

const packageId = "node-reload-steps-vscode";
const runCmdId = `${packageId}.run`;
type RunCmdIdArgs = { controllerId?: number; stepId: string };

export class Extension extends DisposableComponent {
	private decorationType = this.trackDisposable(
		vscode.window.createTextEditorDecorationType({
			after: { margin: "20px" },
		})
	);

	private stepStates: {
		id: string;
		state: "notRun" | "running" | "ran" | "undoing" | "undone";
	}[] = [];

	constructor() {
		super();

		this.updateText();

		this.trackDisposable(
			vscode.window.onDidChangeActiveTextEditor(e => {
				this.updateText();
			})
		);

		this.trackDisposable(
			Server.instance.onStepStatesChanged.sub(state => {
				this.stepStates = state;
				this.updateText();
			})
		);

		this.trackDisposable(
			vscode.commands.registerCommand(runCmdId, (args: RunCmdIdArgs) => {
				this.runStep(args.stepId, args.controllerId);
			})
		);

		if (getReloadCount(module) > 0) {
			this.trackDisposable(
				vscode.window.setStatusBarMessage(
					"Reloads: " + getReloadCount(module)
				)
			);
		}

		this.trackDisposable(
			vscode.debug.onDidChangeActiveDebugSession(e =>
				this.connectClient()
			)
		);

		if (vscode.debug.activeDebugSession) {
			this.connectClient();
		}

		this.trackDisposable(
			vscode.workspace.onDidChangeTextDocument(e => {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					return;
				}
				if (e.document === editor.document) {
					this.updateText();
				}
			})
		);
	}

	private updateText() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		if (this.stepStates.length === 0) {
			editor.setDecorations(this.decorationType, []);
			return;
		}

		const idByLine: { id: string; line: number; text: string }[] = [];

		const txt = editor.document.getText();
		const re = /id\: "(.*)"/g;
		let m;
		while ((m = re.exec(txt))) {
			const line = editor.document.positionAt(m.index).line;
			const id = m[1];
			const state = this.stepStates.find(p => p.id === id);
			if (state) {
				let text: string = "";
				switch (state.state) {
					case "notRun":
						text = "❔ Not run";
						break;
					case "running":
						text = "🏃 Running...";
						break;
					case "ran":
						text = "✔️ Ran";
						break;
					case "undoing":
						text = "◀️ Rewinding...";
						break;
					case "undone":
						text = "⏪ Rewound";
						break;
				}
				idByLine.push({ line, id, text });
			}
		}

		editor.setDecorations(
			this.decorationType,
			idByLine.map(o => {
				const lineEnd = editor.document.lineAt(o.line).range.end;
				const hoverMessage = new vscode.MarkdownString();
				hoverMessage.isTrusted = true;
				const params = encodeURIComponent(
					JSON.stringify({ stepId: o.id } as RunCmdIdArgs)
				);
				hoverMessage.appendMarkdown(
					`* [Run Step '${o.id}'](command:${runCmdId}?${params})`
				);
				const dec: vscode.DecorationOptions = {
					range: new vscode.Range(lineEnd, lineEnd),
					renderOptions: {
						after: {
							contentText: o.text,
						},
					},
					hoverMessage,
				};
				return dec;
			})
		);
	}

	private readonly debuggerConnectionExpr =
		"global['@hediet/node-reload/DebuggerConnection'].instance";

	private async connectClient(): Promise<void> {
		const e = vscode.debug.activeDebugSession;
		if (e) {
			try {
				await wait(500);
				const r = await e.customRequest("evaluate", {
					expression: `${this.debuggerConnectionExpr}.connectTo(${
						Server.instance.port
					});`,
				});
			} catch (e) {
				console.error(e);
			}
		}
		this.updateText();
	}

	private async runStep(
		stepId: string,
		controllerId?: number
	): Promise<void> {
		const e = vscode.debug.activeDebugSession;
		if (e) {
			try {
				const r = await e.customRequest("evaluate", {
					expression: `${
						this.debuggerConnectionExpr
					}.runToStepIncluding("${stepId}");`,
				});
			} catch (e) {
				console.error(e);
			}
		}
	}
}
