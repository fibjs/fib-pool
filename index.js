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
                    }
            }

            if (!p) {
                var cn = 0;

                while (true) {
                    try {
                        o = create(name);
                        break;
                    } catch (e) {
                        if (++cn >= retry)
                            throw e;
                    }
                }
            }

            r = func(o);
            pools[count++] = {
                o: o,
                name: name,
                time: new Date()
            };
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

    return pool;
}