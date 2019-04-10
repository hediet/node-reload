# Hot Reloading for NodeJS

[![](https://img.shields.io/twitter/follow/hediet_dev.svg?style=social)](https://twitter.com/intent/follow?screen_name=hediet_dev)

A thoughtfully designed library that brings advanced hot reloading to NodeJS.

## Usage

### Installation

```
yarn add @hediet/node-reload
```

or

```
npm install @hediet/node-reload --save
```

See the `./examples` folder for detailed examples.
Works best with TypeScript.

### Plain Hot Require

`hotRequire` is the way to go if you just want to watch a module for changes.

```ts
import { enableHotReload, hotRequire } from "@hediet/node-reload";

// Call `enableHotReload` to track dependencies and watch for file changes.
enableHotReload();

hotRequire<typeof import("./dep")>(module, "./dep", cur => {
	// Runs immediately or when `dep` (or any sub dependency of `dep`) changes.
	console.log("value of x: ", cur.x);
});
```

### Hot Require Exported Items

`hotRequireExportedFn` makes it very easy to track changes of exported functions and classes.

```ts
import {
	registerUpdateReconciler,
	hotRequireExportedFn,
	getReloadCount,
	enableHotReload,
} from "@hediet/node-reload";

enableHotReload();
// Call `registerUpdateReconciler` to mark this module as reconcilable.
// If this module (or any dependency that could not be reconciled) changes,
// the `UpdateReconciler` is asked to apply the new module to the old.
// The `UpdateReconciler` powers `getReloadCount`, `hotRequireExportedFn`, `runExportedSteps` and other functions.
registerUpdateReconciler(module);

export function foo(arg: string) {
	console.log(arg + " change me");
}

if (getReloadCount(module) === 0) {
	// only cause side effect on initial load as the entire module is run again on each reload
	hotRequireExportedFn(module, foo, { hasFnChanged: "useSource" }, foo => {
		// is called immediately and whenever the source of `foo` changes.
		foo();
		return { dispose: () => console.log("Free any resources from last invocation"); };
	});
}
```

### Vs Code Extension Reloading

With `hotRequireExportedFn` you can easily make your VS Code Extension hot reloadable:

```ts
import {
	enableHotReload,
	hotRequireExportedFn,
	registerUpdateReconciler,
} from "@hediet/node-reload";
import { DisposableComponent } from "@hediet/std/disposable";
import * as vscode from "vscode";

if (isDevMode()) {
	enableHotReload(module);
}
registerUpdateReconciler(module);

export class Extension extends DisposableComponent {
	constructor() {
		super();
		// Disposables are disposed automatically on reload.
		const item = this.trackDisposable(vscode.window.createStatusBarItem());
		item.text = "Hallo Welt";
		item.show();
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		hotRequireExportedFn(module, Extension, Extension => new Extension())
	);
}
```

### Steps Updater

The steps updater is especially useful in connection with `puppeteer`. See the `./examples` folder on how to use this with `puppeteer`.

```ts
enableHotReload();
registerUpdateReconciler(module);
// Runs the given steps and applies updates by undoing already executed steps and running the new steps.
// Unchanged last steps are run on initial load,
// undone when steps before them change, but only run again when they or a step after them changes.
// This way you can edit and hot reload intermediate steps without running all steps again after every change.
runExportedSteps(module, getSteps);

export function getSteps(): Steps {
	return steps(
		{
			id: "start",
			do: async (args, { onUndo }) => {
				console.log("start");
				onUndo(async () => console.log("undo start"));
				return {
					data: 5,
				};
			},
		},
		{
			id: "continue1",
			do: async (args, { onUndo }) => {
				console.log("continue 1");
				onUndo(async () => console.log("undo 1"));
				return {
					data2: 10,
					...args,
				};
			},
		},
		{
			id: "continue2",
			do: async (args, { onUndo }) => {
				console.log("continue 2", args.data2, args.data);
				onUndo(async () => console.log("undo 2"));
				return {};
			},
		}
	);
}
```

## Similar libs

-   [node-hot](https://github.com/mihe/node-hot): Inspired this library. Does not have the concept of reconcilation and any kind of update reconciler.

## Changelog

-   0.0.2 - Initial release.
