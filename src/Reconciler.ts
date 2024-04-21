import { AttachedProperty } from "./utils";

export interface ModuleUpdateReason {
	oldSource: string;
	newSource: string;
}

export interface UpdateReason {
	/**
	 * Is set, if the current module changed.
	 */
	moduleUpdates?: ModuleUpdateReason;
	/**
	 * Describes the changes of the dependent modules.
	 */
	dependencyUpdates: Map<string, UpdateReason>;
}

export interface ReconcileContext extends UpdateReason {
	/**
	 * Reloads the current module.
	 * The previous version is cleared from cache.
	 * @param prepareModule A callback to prepare the module before it loads.
	 */
	reloadModule<TModule>(
		prepareModule?: (mod: NodeModule) => void
	): { newExports: TModule; newModule: NodeModule };
}

/**
 * A reconciler determines what happens when
 * its module updates or any dependency that could not be reconciled.
 * It can either handle the update by returning `true`,
 * or propagate the update to all dependants of module by returning `false`.
 * A reconciler can decide to reload a module.
 */
export type Reconciler = (context: ReconcileContext) => boolean;

const nodeModuleReconcilerProperty = new AttachedProperty<
	NodeModule,
	Reconciler | undefined
>(() => undefined);

/**
 * @unstable
 * Sets a reconciler for the given module.
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
