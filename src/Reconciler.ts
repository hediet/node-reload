import { AttachedProperty } from "@hediet/std/extensibility";

export interface ModuleUpdateReason {
	oldSource: string;
	newSource: string;
}

export interface UpdateReason {
	moduleUpdates?: ModuleUpdateReason;
	dependencyUpdates: Map<string, UpdateReason>;
}

export interface ReconcileContext extends UpdateReason {
	reloadModule<TModule>(
		prepareModule?: (mod: NodeModule) => void
	): { newExports: TModule; newModule: NodeModule };
}

export type Reconciler = (context: ReconcileContext) => boolean;

const nodeModuleReconcilerProperty = new AttachedProperty<
	NodeModule,
	Reconciler | undefined
>(() => undefined);

/**
 * @unstable
 */
export function setModuleReconciler(
	module: NodeModule,
	reconciler: Reconciler | undefined
) {
	nodeModuleReconcilerProperty.set(module, reconciler);
}

export function getModuleReconciler(module: NodeModule) {
	return nodeModuleReconcilerProperty.get(module);
}

export const nodeModuleSourceProperty = new AttachedProperty<
	NodeModule,
	string | undefined
>(() => undefined);
