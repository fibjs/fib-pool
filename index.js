var coroutine = require('coroutine');
var util = require('util');

module.exports = (opt, maxsize, timeout) => {
    if (util.isFunction(opt)) {
        opt = {
            create: opt,
            maxsize: maxsize,
            timeout: timeout
        };
    }

    var create = opt.create;
    var destroy = opt.destroy || ((o) => {
        if (o.close)
            o.close();
        if (o.destroy)
            o.destroy();
        if (o.dispose)
            o.dispose();
    });

    maxsize = opt.maxsize || 10;
    timeout = opt.timeout || 60000;
    var tm = timeout / 10;
    if (tm < 10)
        tm = 10;

    var retry = opt.retry || 1;

    var pools = [];
    var jobs = [];
    var count = 0;

    var sem = new coroutine.Semaphore(maxsize);
    var clearTimer;

    function clearPool() {
        var c;
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

        if (!clearTimer)
            clearTimer = setInterval(clearPool, tm);
        else if (!count) {
            clearTimer.clear();
            clearTimer = null;
        }
    }

    var pool = (name, func) => {
        if (util.isFunction(name)) {
            func = name;
            name = "";
        }

        function putback(name, o, e) {
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

        var r;
        var o;
        var p = false;

        clearPool();
        sem.acquire();

        try {
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
                coroutine.start(() => {
                    var o;
                    var cn = 0;
                    var err;

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
                });

                var job = {
                    name: name,
                    ev: new coroutine.Event()
                };
                jobs.push(job);

                job.ev.wait();
                if (job.e)
                    throw job.e;
                o = job.o;
            }

            r = func(o);
            putback(name, o);
        } catch (e) {
            if (o !== undefined)
                coroutine.start(destroy, o);
            throw e;
        } finally {
            sem.post();
            clearPool();
        }

        return r;
    }

    pool.connections = () => {
        return count;
    }

    pool.info = () => {
        return {
            maxsize: maxsize,
            count: count,
            wait: sem.count(),
            timeout: timeout
        }
    }

    pool.clear = () => {
        pools.forEach(function (c) {
            destroy(c.o);
            count--;
        });

        pools = [];

        if (clearTimer) {
            clearTimer.clear();
            clearTimer = null;
        }
    }

    return pool;
}