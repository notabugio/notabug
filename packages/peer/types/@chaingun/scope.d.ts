type T = any;

export class GunScopePromise<T> extends Promise<T> {}

export type Promise<T> = GunScopePromise<T>;

export type resolve<T> = (val: T) => GunScopePromise<T>;

export function query<T>(
  fn: (scope: any, ...args: any) => T | GunScopePromise<T>,
  name?: string
): (scope: any, ...args: any[]) => GunScopePromise<T>;

export function resolve<T>(val: T): GunScopePromise<T>;

export function all<T>(promises: PromiseLike<any>[]): GunScopePromise<T>;

export type GunScope = any;

export function scope(opts?: any): GunScope;
