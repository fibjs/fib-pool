/// <reference path="../@types/index.d.ts" />

import coroutine = require('coroutine');
import util = require('util');
import { setInterval } from 'timers';

const Pool = function<T1, T2> (_opt: FibPoolNS.FibPoolOptsArg, maxsize?: number, timeout?: number): FibPoolNS.FibPoolFunction<T1, T2> {
    var opt: FibPoolNS.FibPoolOptionResult = _opt as FibPoolNS.FibPoolOptionResult;
    if (util.isFunction(_opt)) {
        opt = {
            create: _opt,
            maxsize: maxsize,
            timeout: timeout
        } as FibPoolNS.FibPoolOptionResult;
    }

    var create = opt.create;
    var destroy = opt.destroy || ((o: FibPoolNS.FibPoolObjectToExtract) => {
        if (util.isFunction(o.close))
            o.close();
        if (util.isFunction(o.destroy))
            o.destroy();
        if (util.isFunction(o.dispose))
            o.dispose();
    });

    maxsize = opt.maxsize || 10;
    timeout = opt.timeout || 60000;
    var tm = timeout / 10;
    if (tm < 10)
        tm = 10;

    var retry = opt.retry || 1;

    var pools: FibPoolNS.FibPoolUnit[] = [];
    var jobs: FibPoolNS.FibPoolInnerJob[] = [];
    var count = 0;
    var running = 0;

    var sem = new coroutine.Semaphore(maxsize);
    var clearTimer: Class_Timer;

    function clearPool() {
        var c: FibPoolNS.FibPoolUnit;
        var d = new Date().getTime();

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
        } else if (!clearTimer)
            clearTimer = setInterval(clearPool, tm);
    }

    function putback(name: FibPoolNS.FibPoolInnerJobName, o: FibPoolNS.FibPoolPayloadObject, e?: FibPoolNS.FibPoolInnerErr) {
        for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i];
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
        var o: FibPoolNS.FibPoolPayloadObject;
        var cn = 0;
        var err: FibPoolNS.FibPoolInnerErr;

        while (true) {
            try {
                o = create(name);
                break;
            } catch (e) {
                if (++cn >= retry) {
                    err = e;
                    break;
                }
            }
        }

        putback(name, o, err);
    }

    var pool: FibPoolNS.FibPoolFunction = (...args: any[]) => {
        var _name: string|FibPoolNS.FibPoolCallback = args[0]
        var func: FibPoolNS.FibPoolCallback = args[1]

        var name = _name as string;
        if (util.isFunction(_name)) {
            func = _name as FibPoolNS.FibPoolCallback;
            name = "";
        }

        var r;
        var o;
        var p = false;

        clearPool();
        sem.acquire();

        if (count) {
            for (var i = count - 1; i >= 0; i--)
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

            var job: FibPoolNS.FibPoolInnerJob = {
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
            r = func(o);
            putback(name, o);
        } catch (e) {
            if (o !== undefined)
                coroutine.start(destroy, o);
            throw e;
        } finally {
            running--;
            sem.post();
            clearPool();
        }

        return r;
    };

    pool.connections = () => {
        return count;
    }

    pool.info = () => {
        return {
            maxsize: maxsize,
            count: count,
            running: running,
            wait: sem.count(),
            timeout: timeout
        }
    }

    pool.clear = () => {
        timeout = -1;
        clearPool();
    }

    return pool;
}

export = Pool;
