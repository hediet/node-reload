import {
	enableHotReload,
	hotRequireExportedFn,
	registerUpdateReconciler,
} from "../../dist";
import { DisposableComponent } from "@hediet/std/disposable";
import * as vscode from "vscode";

enableHotReload({ entryModule: module });
registerUpdateReconciler(module);

export class Extension extends DisposableComponent {
	constructor() {
		super();
		// Disposables are disposed automatically on reload.
		const item = this.trackDisposable(vscode.window.createStatusBarItem());
		item.text = "hello world";
		item.show();
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		hotRequireExportedFn(module, Extension, Extension => new Extension())
	);
}
