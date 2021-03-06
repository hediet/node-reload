/*import * as esprima from "esprima";
import { Node } from "estree";*/
import * as stackTrace from "stack-trace";
// import { diff } from "deep-diff";

export function reloadable<T extends object>(value: T, initial?: any): T {
    const parentFrame = stackTrace.get()[1];
    const filename = parentFrame.getFileName();
    const id =
        parentFrame.getLineNumber() + "," + parentFrame.getColumnNumber();

    const key = filename + ":" + id;

    const existing = capturedReloadables.get(key);
    if (existing) {
        Object.assign(existing.value, value);
        value = existing.value as T;
    } else {
        if (initial) {
            Object.assign(initial, value);
            value = initial as T;
        }

        capturedReloadables.set(key, {
            filename,
            id,
            value
        });
    }

    return value;
}

interface CapturedReloadable {
    filename: string;
    id: string;
    value: unknown;
}

let capturedReloadables = new Map<string, CapturedReloadable>();

export function installDiffingReconciler(mod: NodeModule) {
    mod.reconciler = ({ moduleUpdates, dependencyUpdates, reloadModule }) => {
        if (dependencyUpdates.size >= 0) {
            return false;
        }

        /*const oldAst = esprima.parseScript(moduleUpdates.oldSource, {
            range: true,
            loc: true
        });
        const newAst = esprima.parseScript(moduleUpdates.newSource, {
            range: true,
            loc: true
        });*/

        /*const diffResult = diff(oldAst, newAst, {
            prefilter: (path, key) => {
                return key === "range";
            }
        });*/

        //const d = new Differ();
        //d.diffAsts(oldAst, newAst);

        const before = reloadWithoutSideEffect;
        reloadWithoutSideEffect = true;

        const newExports = reloadModule();
        reloadWithoutSideEffect = before;

        return true;
    };
}

/*
// both 1-based
type Range = { line: number; column: number };

function isReloadableExpression(ast: Node): undefined | Range {
    if (ast.type !== "CallExpression") {
        return undefined;
    }

    const r = isReloadableIdentifier(ast.callee);
    if (r) {
        return r;
    }

    if (ast.callee.type === "MemberExpression") {
        return isReloadableIdentifier(ast.callee.property);
    }
    return undefined;
}

function isReloadableIdentifier(ast: Node): undefined | Range {
    if (ast.type === "Identifier") {
        if (ast.name === "reloadable") {
            const start = ast.loc!.start;
            return {
                line: start.line,
                column: start.column + 1
            };
        }
    }
    return undefined;
}

class Differ {
    private inReloadableCall: undefined | Range = undefined;

    diffAsts(ast1: Node, ast2: Node): boolean {
        let inReloadableCall = this.inReloadableCall;

        if (isReloadableExpression(ast1)) {
            const r = isReloadableExpression(ast2);
            if (r) {
                this.inReloadableCall = r;
            }
        }

        if (this.inReloadableCall) {
            if (ast1.type === "ObjectExpression") {
            } else if (ast1.type === "Property") {
            }
        }

        const difference = diffObjectsKeys(
            getChildren(ast1),
            getChildren(ast2)
        );
        for (const diff of difference) {
            if (diff.val1 && diff.val2) {
                if (diff.val1.type === "node" && diff.val2.type === "node") {
                    this.diffAsts(diff.val1.node, diff.val2.node);
                } else if (
                    diff.val1.type === "array" &&
                    diff.val2.type === "array"
                ) {
                    const arr1 = diff.val1.items;
                    const arr2 = diff.val2.items;

                    for (
                        let i = 0;
                        i < Math.max(arr1.length, arr2.length);
                        i++
                    ) {
                        const item1 = arr1[i];
                        const item2 = arr2[i];

                        if (item1 && item2) {
                            this.diffAsts(item1, item2);
                        } else if (item1) {
                            console.log("deleted", item1);
                        } else if (item2) {
                            console.log("added", item2);
                        }
                    }
                } else if (
                    diff.val1.type === "primitive" &&
                    diff.val2.type === "primitive"
                ) {
                    if (diff.val1.value !== diff.val2.value) {
                        console.log("val dif");
                    }
                } else {
                }
            } else if (diff.val1) {
            } else if (diff.val2) {
            }
        }
    }
}

function diffAstLists(list1: Node[], list2: Node[]) {}

interface Children {
    [property: string]:
        | { type: "node"; node: Node }
        | { type: "array"; items: Node[] }
        | { type: "primitive"; value: unknown };
}
function getChildren(node: Node): Children {
    const result = {} as Children;
    for (const [property, value] of Object.entries(node)) {
        if (property === "range" || property === "loc") {
            continue;
        }

        if (typeof value === "object" && value !== null && "type" in value) {
            result[property] = { type: "node", node: value as Node };
        } else if (Array.isArray(value)) {
            result[property] = { type: "array", items: value as Node[] };
        } else if (value !== null) {
            result[property] = { type: "primitive", value };
        }
    }
    return result;
}

*/
