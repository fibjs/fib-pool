import * as coroutine from 'coroutine';
import * as util from 'util';

declare namespace FibPoolNS {
    /**
     * The shape the default destroy looks for. All three members are optional:
     * it calls whichever of them the item actually provides, and a non-function
     * value (a plain property) is ignored.
     *
     * This is deliberately *not* a constraint on the pooled item. Every member
     * is optional, which makes it a weak type, and TypeScript rejects any type
     * without a property in common with a weak type. Constraining the item to
     * it would reject the perfectly valid `Pool(() => 10)` and
     * `Pool(() => ({ value: 1 }))`, so the constraint is absent and the cast to
     * this shape happens only inside the default destroy, where a primitive
     * simply has no such member to call.
     */
    interface DippedItemStruct {
        close?: unknown;
        destroy?: unknown;
        dispose?: unknown;
    }

    /**
     * `T` is the pooled item and may be anything `create` returns, including a
     * primitive. It is only inferred, never constrained.
     */
    interface FibPoolOptionArgs<T = any> {
        create: (name: string) => T;
        destroy?: (item?: T) => any;
        maxsize?: number;
        timeout?: number;
        retry?: number;
        strict?: boolean;
    }

    interface FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN = any> {
        (o: T_CREATED_ITEM): T_POOL_FUNC_RETURN
    }

    type FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN = any> = {
        <T_RETURN = T_POOL_FUNC_RETURN>(name: string, func: FibPoolDipperFn<T_CREATED_ITEM, T_RETURN>): T_RETURN
        <T_RETURN = T_POOL_FUNC_RETURN>(func: FibPoolDipperFn<T_CREATED_ITEM, T_RETURN>): T_RETURN
    } & {
        connections(): number;
        info(): {
            maxsize: number;
            count: number;
            running: number;
            wait: number;
            timeout: number;
        };
        clear(): void;
    }
}

/**
 * Calls the value when it is a function and ignores it otherwise: a pooled item
 * may expose a plain property named close/destroy/dispose.
 */
function callIfFunction(v: unknown) {
    if (util.isFunction(v))
        (v as (...args: any[]) => any)();
}

/**
 * `maxsize` and `retry` are counts, `timeout` is a duration. Both are rejected
 * up front instead of being silently coerced into a default or handed to the
 * semaphore, which would fail far from the option that is wrong.
 */
function toPositiveInteger(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || Math.floor(value) !== value)
        throw new TypeError(`${name} must be a positive integer, received ${String(value)}`);

    return value;
}

function toPositiveNumber(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        throw new TypeError(`${name} must be a positive number, received ${String(value)}`);

    return value;
}

/**
 * The pool always hands out an Error: `create` or the callback may throw a
 * string, a number, or nothing at all, and the caller expects to be able to
 * read `.message`. A thrown falsy value (0, '', false, null, undefined) is still
 * a failure and must not be mistaken for a successful create, so this returns an
 * Error for every input.
 */
function toError(e: unknown): Error {
    if (e instanceof Error)
        return e;

    if (typeof e === 'string')
        return new Error(e);

    return new Error(String(e));
}

/**
 * Guards a pooled item while the callback runs. The item is read through a
 * getter rather than captured by value: once it goes back to the pool the
 * handle must stop working, which is what the "outside of pool scope" error
 * reports.
 *
 * The reflection traps matter as much as the getter: without them `key in obj`,
 * `Object.keys`, `for...in` and `JSON.stringify` all see the empty proxy target
 * instead of the item.
 */
function wrapStrict<T extends object>(item: () => T | undefined): T {
    const current = () => {
        const o = item();
        if (o === undefined)
            throw new Error("access object outside of pool scope");

        return o;
    };

    return new Proxy({}, {
        get(target, prop) {
            if (prop === 'close' || prop === 'destroy' || prop === 'dispose')
                throw new Error("Cannot close/destroy/dispose");

            const o = current();
            const value = (o as any)[prop];
            if (typeof value === 'function') {
                /* the item is resolved again when the method runs: a method
                   extracted inside the callback and called after it returned
                   must not keep the item alive outside its scope */
                return function () {
                    const self = current();
                    return (self as any)[prop].apply(self, arguments);
                }
            }
            return value;
        },
        has(target, prop) {
            /* no close/destroy/dispose refusal here: the key is reported like
               any other (ownKeys lists it too), only reading or calling those
               members is refused, in `get` */
            return Reflect.has(current() as object, prop);
        },
        ownKeys() {
            return Reflect.ownKeys(current() as object);
        },
        getOwnPropertyDescriptor(target, prop) {
            const d = Reflect.getOwnPropertyDescriptor(current() as object, prop);

            /* every key of the proxy target is configurable: a descriptor that
               claims otherwise would break the proxy invariants */
            return d && Object.assign(d, { configurable: true });
        },
        set() {
            throw new Error("Cannot set property");
        }
    }) as T;
}

export default function GetPool<
    T_CREATED_ITEM,
    T_POOL_FUNC_RETURN = any
> (
    _opt: FibPoolNS.FibPoolOptionArgs<T_CREATED_ITEM> | FibPoolNS.FibPoolOptionArgs<T_CREATED_ITEM>['create'],
    maxsize?: number,
    timeout?: number
): FibPoolNS.FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN> {
    /* clean input arguments :start */
    let opt: FibPoolNS.FibPoolOptionArgs<T_CREATED_ITEM>;

    if (util.isFunction(_opt)) {
        opt = {
            create: _opt as (name: string) => T_CREATED_ITEM,
            maxsize: maxsize,
            timeout: timeout
        };
    } else {
        opt = _opt as FibPoolNS.FibPoolOptionArgs<T_CREATED_ITEM>;
    }

    const create = opt.create;
    const destroy = opt.destroy || ((o: unknown) => {
        /* create may return null/undefined or any primitive: there is nothing
           to destroy then. Functions are kept, since they can carry members. */
        if (o === null || o === undefined)
            return;

        if (typeof o !== 'object' && typeof o !== 'function')
            return;

        const item = o as FibPoolNS.DippedItemStruct;

        callIfFunction(item.close);
        callIfFunction(item.destroy);
        callIfFunction(item.dispose);
    });

    const maxsizeValue = opt.maxsize === undefined ? 10 : toPositiveInteger(opt.maxsize, 'maxsize');
    let timeoutValue = opt.timeout === undefined ? 60000 : toPositiveNumber(opt.timeout, 'timeout');

    /* the idle scan runs at a tenth of the timeout, but never more often than
       every 10ms */
    let tm = timeoutValue / 10;
    if (tm < 10)
        tm = 10;

    const retry = opt.retry === undefined ? 1 : toPositiveInteger(opt.retry, 'retry');
    const strictMode = opt.strict === undefined ? true : opt.strict;
    /* clean input arguments :end */

    let pools = <{
        o: T_CREATED_ITEM;
        name: string;
        time: Date;
    }[]>[];

    const jobs = <{
        name: string;
        ev: Class_Event;
        o?: T_CREATED_ITEM;
        e?: Error;
    }[]>[];

    let count = 0;
    let running = 0;

    const sem = new coroutine.Semaphore(maxsizeValue);
    let clearTimer: Class_Timer | null = null;

    function clearPool() {
        const d = new Date().getTime();

        while (count) {
            const c = pools[0];

            if (d - c.time.getTime() > timeoutValue) {
                pools = pools.slice(1);
                count--;

                if (c.o !== undefined)
                    coroutine.start(destroy, c.o);
            } else
                break;
        }

        if (!count) {
            if (clearTimer) {
                clearTimer.clear();
                clearTimer = null;
            }
        } else if (!clearTimer) {
            /* the timer must not hold the process alive: the pool is idle
               between uses */
            clearTimer = setInterval(clearPool, tm).unref();
        }
    }

    /**
     * Hand the item back: wake the first waiter bound to `name`, or park the
     * item in the idle list. An errored item is never parked, but a successful
     * create may legitimately produce `undefined` and is parked as is.
     */
    function putback(
        name: string,
        o: T_CREATED_ITEM | undefined,
        e?: Error
    ) {
        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            if (job.name === name) {
                jobs.splice(i, 1);
                job.o = o;
                job.e = e;
                job.ev.set();
                return;
            }
        }

        if (e === undefined) {
            /* The idle list is capped by maxsize: a pool used with more names
               than that would otherwise keep one idle item per name and grow
               without bound. The oldest idle item gives way to the one just
               returned, so the most recently used names stay cached. */
            if (count >= maxsizeValue && count) {
                const evicted = pools[0];
                pools = pools.slice(1);
                count--;
                coroutine.start(destroy, evicted.o);
            }

            pools[count++] = {
                o: o as T_CREATED_ITEM,
                name: name,
                time: new Date()
            };
        }
    }

    function connect(name: string) {
        let o: T_CREATED_ITEM | undefined;
        let err: Error | undefined;

        for (let cn = 1; ; cn++) {
            try {
                o = create(name);
                break;
            } catch (e) {
                /* any thrown value is a failure, including 0 or '' */
                if (cn >= retry) {
                    err = toError(e);
                    break;
                }
            }
        }

        putback(name, o, err);
    }

    /* The fiber is used as fiber-local storage: it is the only place a marker
       can live without leaking between fibers. A fiber that already holds an
       item from this pool would wait on itself when it asks again, which the
       semaphore can never satisfy once every permit is out. */
    const fiberDepth = Symbol('fib-pool depth');

    type FiberState = Class_Fiber & { [fiberDepth]?: true };

    function enterFiber(): FiberState {
        const fiber = coroutine.current() as FiberState;

        if (fiber[fiberDepth])
            throw new Error("Cannot pool again from the same fiber: the pool is already held by this callback");

        fiber[fiberDepth] = true;

        return fiber;
    }

    function leaveFiber(fiber: FiberState) {
        delete fiber[fiberDepth];
    }

    const pool = ((
        name: string | FibPoolNS.FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN>,
        func?: FibPoolNS.FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN>
    ) => {
        if (typeof name === 'function') {
            func = name;
            name = "";
        }

        const dip = func as FibPoolNS.FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN>;

        let r: T_POOL_FUNC_RETURN;
        let o: T_CREATED_ITEM | undefined;
        let reused = false;
        const fiber = enterFiber();

        try {
            clearPool();
            sem.acquire();

            if (count) {
                for (let i = count - 1; i >= 0; i--)
                    if (pools[i].name === name) {
                        reused = true
                        o = pools[i].o;
                        pools.splice(i, 1);
                        count--;
                        break;
                    }
            }

            if (!reused) {
                coroutine.start(connect, name);

                const job: typeof jobs[any] = {
                    name: name,
                    ev: new coroutine.Event()
                };
                jobs.push(job);

                job.ev.wait();
                if (job.e) {
                    sem.post();
                    throw job.e;
                }
                o = job.o;
            }

            running++;
            try {
                const po = (strictMode && o !== null && typeof o === 'object')
                    ? wrapStrict<T_CREATED_ITEM & object>(() => o as T_CREATED_ITEM & object)
                    : o as T_CREATED_ITEM;

                r = dip(po);
                putback(name, o);
                o = undefined;
            } catch (e) {
                if (o !== undefined)
                    coroutine.start(destroy, o);
                o = undefined;
                throw toError(e);
            } finally {
                running--;
                sem.post();
                clearPool();
            }

            return r;
        } finally {
            leaveFiber(fiber);
        }
    }) as FibPoolNS.FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN>;

    pool.connections = () => count

    pool.info = () => ({
        maxsize: maxsizeValue,
        count: count,
        running: running,
        wait: sem.count(),
        timeout: timeoutValue
    })

    pool.clear = () => {
        timeoutValue = -1;
        clearPool();
    }

    return pool;
}
