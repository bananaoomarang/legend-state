import { isArray, isObject } from '@legendapp/tools';
import { ObservableChecker3, PathNode } from './observableInterfaces';
import { observableConfiguration } from './configureObservable';

export const symbolDateModified = Symbol('__dateModified');
export const symbolShallow = Symbol('__shallow');
export const symbolEqualityFn = Symbol('__equalityFn');
export const symbolValue = Symbol('__value');
export const symbolProp = Symbol('__prop');

export function removeNullUndefined<T extends Record<string, any>>(a: T) {
    if (a === undefined) return null;
    Object.keys(a).forEach((key) => {
        const v = a[key];
        if (v === null || v === undefined) {
            delete a[key];
        } else if (isObject(v)) {
            removeNullUndefined(v);
        }
    });
}

export function replaceKeyInObject(obj: object, keySource: any, keyTarget: any, clone: boolean) {
    if (isObject(obj)) {
        const target = clone ? {} : obj;
        if (obj[keySource]) {
            target[keyTarget] = obj[keySource];
            delete target[keySource];
        }
        Object.keys(obj).forEach((key) => {
            if (key !== keySource) {
                target[key] = replaceKeyInObject(obj[key], keySource, keyTarget, clone);
            }
        });
        return target;
    } else {
        return obj;
    }
}

export function isPrimitive(val: any) {
    return (
        !isObject(val) &&
        !isArray(val) &&
        !(val instanceof WeakMap) &&
        !(val instanceof WeakSet) &&
        !(val instanceof Error) &&
        !(val instanceof Date) &&
        !(val instanceof String) &&
        !(val instanceof ArrayBuffer)
    );
}
export function isPrimitive2(arg) {
    var type = typeof arg;
    return arg == null || (type != 'object' && type != 'function');
}

export function isCollection(obj: any) {
    return isArray(obj) || obj instanceof Map || obj instanceof Set || obj instanceof WeakMap || obj instanceof WeakSet;
}

export function getDateModifiedKey(dateModifiedKey: string) {
    return dateModifiedKey || observableConfiguration.dateModifiedKey || '@';
}

export function clone(obj: any) {
    return obj === undefined || obj === null
        ? obj
        : isArray(obj)
        ? obj.slice()
        : isObject(obj)
        ? Object.assign({}, obj)
        : JSON.parse(JSON.stringify(obj));
}

export function arrayStartsWith(arr1: any[], arr2: any[]) {
    for (let i = 0; i < arr2.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }

    return true;
}

export function getValueAtPath(root: object, path: string[]) {
    let child = root;
    for (let i = 0; i < path.length; i++) {
        if (child) {
            child = child[path[i]];
        }
    }
    return child;
}

export function getNodeValue(node: PathNode) {
    return getValueAtPath(node.root, node.path);
}

export function callKeyed(fn: Function, node: PathNode, ...args: any[]) {
    const last = node.path[node.path.length - 1];
    const parent = { path: node.path.slice(0, -1), root: node.root };
    return fn.call(this, parent, last, ...args);
}

export function getObservableRawValue<T>(obs: ObservableChecker3<T>): T {
    const prop = obs[symbolProp as any];
    if (prop) {
        return getNodeValue(prop.node)?.[prop.key] as any;
    } else {
        const eq = obs[symbolEqualityFn as any];
        if (eq) {
            return getObservableRawValue(eq.obs);
        } else {
            return obs[symbolShallow as any] || obs;
        }
    }
}
