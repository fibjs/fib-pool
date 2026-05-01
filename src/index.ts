import * as coroutine from 'coroutine';
import * as util from 'util';

declare namespace FibPoolNS {
    type FirstParameter<T> = T extends (arg: infer T, ...args: any[]) => any ? T : never; 

    interface DippedItemStruct {
        close?: FibPoolOptionResult['destroy'];
        destroy?: FibPoolOptionResult['destroy'];
        dispose?: FibPoolOptionResult['destroy'];
    }

    interface FibPoolOptionArgs<T extends DippedItemStruct = {}> {
        create: (name: string) => T
        destroy?: (item?: T) => any;
        maxsize?: number
        timeout?: number
        retry?: number | boolean
        strict?: boolean
    }
    interface FibPoolOptionResult<T extends DippedItemStruct = {}> {
        create: FibPoolOptionArgs<T>['create']
        destroy: FibPoolOptionArgs<T>['destroy']
        maxsize: FibPoolOptionArgs<T>['maxsize']
        timeout: FibPoolOptionArgs<T>['timeout']
        retry: FibPoolOptionArgs<T>['retry']
        strict: FibPoolOptionArgs<T>['strict']
    }

    interface FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN = any> {
        (o: T_CREATED_ITEM): T_POOL_FUNC_RETURN
    }

    type FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN = any> = {
        <T_RETURN = T_POOL_FUNC_RETURN>(name: string, func: FibPoolDipperFn<T_CREATED_ITEM, T_RETURN>): T_RETURN
        <T_RETURN = T_POOL_FUNC_RETURN>(func: FibPoolDipperFn<T_CREATED_ITEM, T_RETURN>): T_RETURN
    } & {
        connections?(): number;
        info?(): {
            maxsize: number;
            count: number;
            running: number;
            wait: number;
            timeout: number;
        }; 
        clear?(): void;
    }
}

function ensureError (e: string | Error) {
    if (typeof e === 'string')
        e = new Error(e)
   
   return e
}

export default function GetPool<
    T_CREATED_ITEM extends FibPoolNS.DippedItemStruct,
    T_POOL_FUNC_RETURN
> (
    _opt: FibPoolNS.FibPoolOptionArgs<T_CREATED_ITEM> | FibPoolNS.FibPoolOptionArgs<T_CREATED_ITEM>['create'],
    maxsize?: number,
    timeout?: number
): FibPoolNS.FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN> {
    /* clean input arguments :start */
    let opt = <FibPoolNS.FibPoolOptionResult<T_CREATED_ITEM>>_opt;
    if (util.isFunction(_opt)) {
        opt = <FibPoolNS.FibPoolOptionResult<T_CREATED_ITEM>>{
            create: _opt,
            maxsize: maxsize,
            timeout: timeout
        };
    }

    const create = opt.create;
    const destroy = opt.destroy || ((o: {
        close?: FibPoolNS.FibPoolOptionResult<T_CREATED_ITEM>['destroy'];
        destroy?: FibPoolNS.FibPoolOptionResult<T_CREATED_ITEM>['destroy'];
        dispose?: FibPoolNS.FibPoolOptionResult<T_CREATED_ITEM>['destroy'];
    }) => {
        if (util.isFunction(o.close)) o.close();
        if (util.isFunction(o.destroy)) o.destroy();
        if (util.isFunction(o.dispose)) o.dispose();
    });

    maxsize = opt.maxsize || 10;
    timeout = opt.timeout || 60000;
    let tm = timeout / 10;
    if (tm < 10)
        tm = 10;

    const retry = opt.retry || 1;
    const _strict = opt.strict === undefined ? true : opt.strict;
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

    const sem = new coroutine.Semaphore(maxsize);
    let clearTimer: Class_Timer;

    function clearPool() {
        let c: typeof pools[any];
        const d = new Date().getTime();

        while (count) {
            c = pools[0];

            if (d - c.time.getTime() > timeout) {
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
            clearTimer = setInterval(clearPool, tm);
            if (clearTimer && typeof clearTimer.unref === 'function')
                clearTimer.unref();
        }
    }

    function putback(
        name: typeof jobs[any]['name'],
        o: T_CREATED_ITEM,
        e?: Error
    ) {
        e = ensureError(e);
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

        if (e === undefined)
            pools[count++] = {
                o: o,
                name: name,
                time: new Date()
            };
    }

    function connect(name: string) {
        let o: T_CREATED_ITEM;
        let cn = 0;
        let err: Error;

        while (true) {
            try {
                o = create(name);
                break;
            } catch (e) {
                if (++cn >= (retry as number)) {
                    err = e;
                    break;
                }
            }
        }

        putback(name, o, err);
    }

    const pool: FibPoolNS.FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN> = (
        name: string | FibPoolNS.FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN>,
        func?: FibPoolNS.FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN>
    ) => {
        if (typeof name === 'function') {
            func = name as any;
            name = "";
        }  

        let r: T_POOL_FUNC_RETURN;
        let o: typeof jobs[any]['o'];
        let p = false;

        clearPool();
        sem.acquire();

        if (count) {
            for (let i = count - 1; i >= 0; i--)
                if (pools[i].name === name) {
                    p = true
                    o = pools[i].o;
                    pools.splice(i, 1);
                    count--;
                    break;
                }
        }

        if (!p) {
            coroutine.start(connect, name);

            const job = <typeof jobs[any]>{
                name: name,
                ev: new coroutine.Event()
            };
            jobs.push(job);

            job.ev.wait();
            if (job.e) {
                sem.post();
                throw ensureError(job.e);
            }
            o = job.o;
        }

        running++;
        try {
            const po = (_strict && typeof o === 'object') ? new Proxy({}, {
                get: function (target, prop) {
                    if (prop === 'close' || prop === 'destroy' || prop === 'dispose')
                        throw new Error("Cannot close/destroy/dispose");
                    if (o === undefined)
                        throw new Error("access object outside of pool scope");
                    const value = o[prop];
                    if (typeof value === 'function') {
                        return function () {
                            return value.apply(o, arguments);
                        }
                    }
                    return value;
                },
                set: function (target, prop, value) {
                    throw new Error("Cannot set property");
                }
            }) as any : o;

            r = func(po as T_CREATED_ITEM);
            putback(name, o);
            o = undefined;
        } catch (e) {
            if (o !== undefined)
                coroutine.start(destroy, o);
            o = undefined;
            throw ensureError(e);
        } finally {
            running--;
            sem.post();
            clearPool();
        }

        return r;
    };

    pool.connections = () => count

    pool.info = () => ({
        maxsize: maxsize,
        count: count,
        running: running,
        wait: sem.count(),
        timeout: timeout
    })

    pool.clear = () => {
        timeout = -1;
        clearPool();
    }

    return pool;
}
