import { describe, it, afterEach } from "node:test";
import assert from "assert";
import coroutine from "coroutine";
import { createRequire } from "module";

import Pool from "../src";

describe("pool", () => {
    const pools = [];

    afterEach(() => {
        for (const p of pools) {
            p.clear();
        }
        pools.length = 0;
    });

    it("run", () => {
        var p = Pool(() => {
            return 10;
        });
        pools.push(p);

        assert.equal(p((v) => {
            return v + 1;
        }), 11);
    });

    it("pool", () => {
        var n = 0;
        var running = -1;

        var p = Pool(() => {
            n++;
            return n;
        });
        pools.push(p);

        assert.equal(p((v) => {
            running = p.info().running;
            return v + 1;
        }), 2);

        assert.equal(running, 1);
        assert.equal(p.info().running, 0);
    });

    it("maxsize", () => {
        var n = 0;
        var m = 0;

        var p = Pool(() => {
            // n++;
            return n;
        }, 10);
        pools.push(p);

        coroutine.parallel(() => {
            p((c) => {
                n++;
                if (n > m)
                    m = n;
                coroutine.sleep(50);
                n--;
            });
        }, 20);

        assert.equal(m, 10);
    });

    it("name", () => {
        var n = 0;

        var p = Pool((name) => {
            n++;
            return name;
        });
        pools.push(p);

        assert.equal(n, 0);

        assert.equal(p('a', (v) => {
            return v;
        }), 'a');

        assert.equal(n, 1);

        assert.equal(p('b', (v) => {
            return v;
        }), 'b');

        assert.equal(n, 2);

        assert.equal(p('a', (v) => {
            return v;
        }), 'a');

        assert.equal(n, 2);
    });

    it("throw", () => {
        var n = 0;
        var running = -1;

        var p = Pool(() => {
            n++;
            return n;
        });
        pools.push(p);

        assert.equal(p((v) => {
            return v + 1;
        }), 2);

        assert.throws(() => {
            p((v) => {
                running = p.info().running;
                throw "error";
            });
        });
        assert.equal(running, 1);
        assert.equal(p.info().running, 0);

        assert.equal(p((v) => {
            return v + 1;
        }), 3);
    });

    it("async close when throw", () => {
        var called = false;

        var p = Pool({
            create: () => {
                return 100;
            },
            destroy: (o) => {
                called = true;
            }
        });
        pools.push(p);

        assert.throws(() => {
            p((v) => {
                throw "error";
            });
        });

        assert.isFalse(called);
        coroutine.sleep(10);
        assert.isTrue(called);
    });

    it("default close function", () => {
        var called = false;

        var p = Pool({
            create: () => {
                return {
                    close: () => {
                        called = true;
                    }
                };
            }
        });
        pools.push(p);

        assert.throws(() => {
            p((v) => {
                throw "error";
            });
        });

        assert.isFalse(called);
        coroutine.sleep(10);
        assert.isTrue(called);
    });

    it("default destroy function", () => {
        var called = false;

        var p = Pool({
            create: () => {
                return {
                    destroy: () => {
                        called = true;
                    }
                };
            }
        });
        pools.push(p);

        assert.throws(() => {
            p((v) => {
                throw "error";
            });
        });

        assert.isFalse(called);
        coroutine.sleep(10);
        assert.isTrue(called);
    });


    it("default destroy function, but destroy is not a function, mongodb3.0 case", () => {
        var cnt = 0;
        var p = Pool({
            create: () => {
                return {
                    destroy: ++cnt
                }
            }
        })
        pools.push(p);

        assert.throws(() => {
            p((v) => {
                throw "error";
            });
        });

        assert.equal(cnt, 1);
    });

    it("default dispose function", () => {
        var called = false;

        var p = Pool({
            create: () => {
                return {
                    dispose: () => {
                        called = true;
                    }
                };
            }
        });
        pools.push(p);

        assert.throws(() => {
            p((v) => {
                throw "error";
            });
        });

        assert.isFalse(called);
        coroutine.sleep(10);
        assert.isTrue(called);
    });

    it("clean timeout", () => {
        var called = false;

        var p = Pool({
            create: () => {
                return 100;
            },
            destroy: (o) => {
                called = true;
            },
            timeout: 10
        });
        pools.push(p);

        p((v) => {});

        assert.isFalse(called);
        assert.equal(p.connections(), 1);
        coroutine.sleep(100);
        assert.isTrue(called);
        assert.equal(p.connections(), 0);
    });

    it("retry", () => {
        var n = 0;

        var p = Pool(() => {
            n++;
            throw "open error";
        });
        pools.push(p);

        assert.throws(() => {
            p((v) => {});
        });

        assert.equal(n, 1);

        var n1 = 0;
        var p1 = Pool({
            create: () => {
                n1++;
                throw "open error";
            },
            retry: 10
        });
        pools.push(p1);

        assert.throws(() => {
            p1((v) => {});
        });

        assert.equal(n1, 10);

        var n2 = 0;
        var p2 = Pool({
            create: () => {
                n2++;
                if (n2 == 3)
                    return;
                throw "open error";
            },
            retry: 10
        });
        pools.push(p2);

        p2((v) => {});

        assert.equal(n2, 3);
    });

    it("long time create", () => {
        var called = 0;

        var p = Pool({
            create: () => {
                called++;
                if (called == 1)
                    coroutine.sleep(20);
                return called;
            }
        });
        pools.push(p);

        var cs = [];
        coroutine.parallel([0, 1, 2, 3, 4], n => {
            p((c) => {
                coroutine.sleep(1);
                cs[n] = c;
            });
        });

        assert.deepEqual(cs, [2, 3, 4, 5, 2]);
        assert.equal(p.info().count, 4);
        coroutine.sleep(100);
        assert.equal(p.info().count, 5);
    });

    it("long time fault create", () => {
        var called = 0;

        var p = Pool({
            create: () => {
                called++;
                if (called == 1) {
                    coroutine.sleep(20);
                    throw 100;
                }
                return called;
            }
        });
        pools.push(p);

        var cs = [];
        coroutine.parallel([0, 1, 2, 3, 4], n => {
            p((c) => {
                coroutine.sleep(1);
                cs[n] = c;
            });
        });

        assert.deepEqual(cs, [2, 3, 4, 5, 2]);
        assert.equal(p.info().count, 4);
        coroutine.sleep(100);
        assert.equal(p.info().count, 4);
    });

    it("maxsize and create", () => {
        var createCount = 0,
            maxsize = 2;

        var p = Pool({
            create: () => {
                createCount++;
                return {};
            },
            maxsize: maxsize
        });
        pools.push(p);

        coroutine.parallel(["a", "b", "c", "d"], n => {
            p((n) => {
                coroutine.sleep(50);
            })
        });

        assert.equal(createCount, maxsize);
    });

    it("clear", () => {
        function parallel(data) {
            coroutine.parallel(data, function (n) {
                p((n) => {
                    coroutine.sleep(50);
                })
            });
        };

        var maxsize = 3;

        var p = Pool({
            create: () => {
                return {};
            },
            maxsize: maxsize,
            timeout: 60 * 1000
        });
        pools.push(p);

        parallel(["a", "b", "c", "d"]);

        assert.equal(p.info().count, maxsize);

        p.clear();
        coroutine.sleep(100);

        assert.equal(p.info().count, 0);

        parallel(["a"]);

        assert.equal(p.info().count, 0);
    });

    it("throw real error", () => {
        var called = false;
        var destroyed = false;

        var p = Pool({
            create: () => {
                return 100;
            },
            destroy: (o) => {
                destroyed = true;
            }
        });
        pools.push(p);

        try {
            p((v) => {
                throw "error";
            });
        } catch (error) {
            called = true
            assert.isObject(error)
            assert.equal(error.message, 'error')
        }

        assert.isTrue(called);

        assert.isFalse(destroyed);
        coroutine.sleep(10);
        assert.isTrue(destroyed);
    });

    it("strict mode - proxy restrictions", () => {
        var p = Pool({
            create: () => ({
                value: 1,
                test: function() { return this.value; }
            })
        });
        pools.push(p);

        p(obj => {
            // Test method access
            assert.equal(obj.test(), 1);
            
            // Test property access restriction
            assert.throws(() => {
                obj.value = 2;
            });

            // Test close/destroy/dispose restriction
            assert.throws(() => {
                obj.close();
            });
            assert.throws(() => {
                obj.destroy();
            });
            assert.throws(() => {
                obj.dispose();
            });
        });
    });

    it("strict mode - access outside pool scope", () => {
        var p = Pool({
            create: () => ({
                value: 1,
                getValue: function() { return this.value; }
            })
        });
        pools.push(p);

        var leaked;
        p(obj => {
            leaked = obj;
            // Should work inside pool scope
            assert.equal(obj.getValue(), 1);
        });

        // Should fail outside pool scope
        assert.throws(() => {
            leaked.getValue();
        }, /access object outside of pool scope/);
    });

    it("strict mode disabled", () => {
        var p = Pool({
            create: () => ({
                value: 1,
                test: function() { return this.value; }
            }),
            strict: false
        });
        pools.push(p);

        var leaked;
        p(obj => {
            leaked = obj;
            // Should work inside pool scope
            assert.equal(obj.test(), 1);
            
            // Should allow property mutation when strict is false
            obj.value = 2;
            assert.equal(obj.value, 2);
        });

        // Should work outside pool scope when strict is false
        assert.equal(leaked.test(), 2);
    });

    it("strict mode - access nested object properties", () => {
        var p = Pool({
            create: () => ({
                driver: {
                    name: "test-driver",
                    execQuery: function(sql, ...params) {
                        return { sql, params };
                    },
                    config: {
                        timeout: 3000
                    }
                },
                getValue: function() { return 100; }
            })
        });
        pools.push(p);

        p(conn => {
            // Should be able to access nested objects
            assert.equal(conn.driver.name, "test-driver");
            
            // Should be able to call methods on nested objects
            const result = conn.driver.execQuery("SELECT * FROM table", "param1");
            assert.equal(result.sql, "SELECT * FROM table");
            assert.deepEqual(result.params, ["param1"]);
            
            // Should be able to access deeply nested properties
            assert.equal(conn.driver.config.timeout, 3000);
            
            // Should still be able to call methods on the root object
            assert.equal(conn.getValue(), 100);
        });
    });

    it("strict mode - the guarded object reflects like the item", () => {
        var p = Pool({
            create: () => ({
                value: 1,
                label: "item",
                getValue: function() { return this.value; }
            })
        });
        pools.push(p);

        p(obj => {
            assert.isTrue('value' in obj);
            assert.isTrue('getValue' in obj);
            assert.isFalse('missing' in obj);

            assert.deepEqual(Object.keys(obj).sort(), ['getValue', 'label', 'value']);
            assert.deepEqual(
                Object.entries(obj).filter(e => e[0] !== 'getValue').sort((a, b) => a[0] < b[0] ? -1 : 1),
                [['label', 'item'], ['value', 1]]
            );

            var copied = {};
            for (var key in obj)
                copied[key] = obj[key];
            assert.equal(copied.label, "item");

            assert.deepEqual({ ...obj }.label, "item");
        });
    });

    it("strict mode - JSON.stringify works on the guarded object", () => {
        var p = Pool({
            create: () => ({ value: 1, label: "item" })
        });
        pools.push(p);

        assert.equal(p(obj => JSON.stringify(obj)), '{"value":1,"label":"item"}');
    });

    it("strict mode - an extracted method cannot reach the item after the scope", () => {
        var p = Pool({
            create: () => ({
                value: 1,
                getValue: function() { return this.value; }
            })
        });
        pools.push(p);

        var extracted;
        p(obj => {
            assert.equal(obj.getValue(), 1);
            extracted = obj.getValue;
        });

        assert.throws(() => {
            extracted();
        }, /access object outside of pool scope/);
    });

    it("strict mode - non-object item is handed out as is", () => {
        var p = Pool(() => 10);
        pools.push(p);

        assert.equal(p(v => v), 10);
    });

    it("null item is handed out and destroyed without failing", () => {
        var created = 0;
        var p = Pool({
            create: () => {
                created++;
                return null;
            },
            timeout: 10
        });
        pools.push(p);

        var got = "unset";
        p((item) => {
            got = item;
        });

        assert.equal(created, 1);
        assert.isNull(got);

        // the idle item is evicted through the default destroy, which must not
        // touch null
        coroutine.sleep(60);
        assert.equal(p.connections(), 0);
    });

    it("undefined item is handed out and parked as is", () => {
        var p = Pool({ create: () => undefined });
        pools.push(p);

        var ran = 0;
        p((item) => {
            ran++;
            assert.isUndefined(item);
        });

        assert.equal(ran, 1);
        assert.equal(p.connections(), 1);
    });

    it("create error that is not an Error object is normalized", () => {
        var p = Pool({
            create: () => {
                throw 100;
            }
        });
        pools.push(p);

        assert.throws(() => {
            p(() => {});
        }, (error) => {
            assert.isObject(error);
            assert.isTrue(error instanceof Error);
            assert.equal(error.message, '100');
            return true;
        });
    });

    it("falsy create error is not swallowed", () => {
        [0, "", false, null, undefined].forEach((thrown) => {
            var calls = 0;
            var p = Pool({
                create: () => {
                    calls++;
                    throw thrown;
                }
            });
            pools.push(p);

            assert.throws(() => {
                p(() => {});
            }, Error, `create throwing ${String(thrown)} must not be swallowed`);
            assert.equal(calls, 1);
        });
    });

    it("callback error that is not an Error object is normalized", () => {
        var p = Pool(() => ({}));
        pools.push(p);

        assert.throws(() => {
            p(() => {
                throw 42;
            });
        }, (error) => {
            assert.isTrue(error instanceof Error);
            assert.equal(error.message, '42');
            return true;
        });
    });

    it("idle items never exceed maxsize", () => {
        var destroyed = 0;
        var p = Pool({
            create: () => {
                return { close() { destroyed++; } };
            },
            maxsize: 2
        });
        pools.push(p);

        ['a', 'b', 'c', 'd', 'e'].forEach(name => p(name, () => {}));

        assert.isTrue(p.connections() <= 2, `idle count ${p.connections()} must not exceed maxsize 2`);

        // the evicted items are destroyed, not leaked
        coroutine.sleep(20);
        assert.equal(destroyed, 3);
    });

    it("idle items of one name still share the maxsize budget", () => {
        var p = Pool({
            create: () => ({}),
            maxsize: 2
        });
        pools.push(p);

        ['a', 'b', 'c'].forEach(name => p(name, () => {}));

        assert.isTrue(p.connections() <= 2);
    });

    it("evicting an idle item destroys it", () => {
        var destroyed = 0;
        var p = Pool({
            create: () => ({ close() { destroyed++; } }),
            maxsize: 1
        });
        pools.push(p);

        p('a', () => {});
        p('b', () => {});

        assert.equal(p.connections(), 1);
        coroutine.sleep(20);
        assert.equal(destroyed, 1);
    });

    it("the idle cap does not thrash on a small set of names", () => {
        var created = 0;
        var p = Pool({
            create: () => {
                created++;
                return {};
            },
            maxsize: 2
        });
        pools.push(p);

        for (var i = 0; i < 10; i++) {
            p('a', () => {});
            p('b', () => {});
        }

        assert.equal(created, 2);
        assert.equal(p.connections(), 2);
    });

    it("nested acquisition from the same fiber throws instead of deadlocking", () => {
        var p = Pool({
            create: () => ({}),
            maxsize: 1
        });
        pools.push(p);

        assert.throws(() => {
            p(() => {
                p(() => {});
            });
        }, /Cannot pool again from the same fiber/);

        // the guard is released even though the inner call threw
        assert.equal(p(() => "ok"), "ok");
        assert.equal(p.info().running, 0);
    });

    it("nested acquisition from the same fiber is refused even with spare capacity", () => {
        var p = Pool({
            create: () => ({ value: 1 }),
            maxsize: 5
        });
        pools.push(p);

        assert.throws(() => {
            p((o) => {
                return p((inner) => inner.value) + o.value;
            });
        }, /Cannot pool again from the same fiber/);

        assert.equal(p(() => "ok"), "ok");
    });

    it("nested acquisition from another fiber is allowed", () => {
        var p = Pool({
            create: () => ({}),
            maxsize: 2
        });
        pools.push(p);

        var nested = "not run";
        p(() => {
            coroutine.start(() => {
                nested = p(() => "inner");
            });
            coroutine.sleep(20);
        });

        assert.equal(nested, "inner");
    });

    it("maxsize is validated", () => {
        [-1, 0, 1.5, NaN, "4", null, true].forEach((maxsize) => {
            assert.throws(() => Pool({ create: () => ({}), maxsize }), /maxsize must be a positive integer/,
                `maxsize ${String(maxsize)} must be rejected`);
        });
    });

    it("timeout is validated", () => {
        [-5, 0, NaN, "1000", null, true].forEach((timeout) => {
            assert.throws(() => Pool({ create: () => ({}), timeout }), /timeout must be a positive number/,
                `timeout ${String(timeout)} must be rejected`);
        });
    });

    it("retry is validated", () => {
        [0, -3, 1.5, true, false, "3", null].forEach((retry) => {
            assert.throws(() => Pool({ create: () => ({}), retry }), /retry must be a positive integer/,
                `retry ${String(retry)} must be rejected`);
        });

        // a number is accepted
        var p = Pool({ create: () => ({}), retry: 3 });
        pools.push(p);
        assert.equal(p(() => "ok"), "ok");
    });

    it("omitted options fall back to the defaults", () => {
        var p = Pool(() => ({}));
        pools.push(p);

        assert.equal(p.info().maxsize, 10);
        assert.equal(p.info().timeout, 60000);
    });

    // The pooled item is not constrained: `create` may return a primitive, a
    // function, or a plain object with no close/destroy/dispose member. These
    // cases used to be rejected by the type constraint even though the runtime
    // always supported them.
    it("an item may be a primitive", () => {
        var p = Pool(() => 10);
        pools.push(p);

        assert.equal(p((v) => v + 1), 11);
        assert.strictEqual(p((v) => v), 10);
    });

    it("an item may be a plain object without lifecycle members", () => {
        var p = Pool(() => ({ value: 1 }));
        pools.push(p);

        assert.equal(p((o) => o.value), 1);
    });

    it("an item may be a function", () => {
        var closed = 0;

        var p = Pool(() => {
            var fn = () => "called";
            fn.close = () => { closed++; };
            return fn;
        }, 1);
        pools.push(p);

        assert.equal(p((fn) => fn()), "called");

        p.clear();
        coroutine.sleep(20);
        assert.equal(closed, 1);
    });

    it("a primitive item is destroyed without failing", () => {
        // the default destroy must not try to read close/destroy/dispose off a
        // primitive, and must not throw on null/undefined either
        [0, "", false, null, undefined].forEach((value) => {
            var p = Pool({ create: () => value }, 1);
            pools.push(p);

            assert.strictEqual(p((v) => v), value);
        });
    });

    // `require('fib-pool')` must hand back the factory itself, not a module
    // namespace object. The ESM implementation is bridged by src/index.cts.
    it("commonjs entry point exports the factory directly", () => {
        const requireCJS = createRequire(import.meta.filename);
        const RequiredPool = requireCJS("../src/index.cts");

        assert.equal(typeof RequiredPool, "function");
        assert.equal(RequiredPool, Pool);

        var p = RequiredPool(() => 10);
        pools.push(p);

        assert.equal(p((v) => v + 1), 11);
    });

    it("package entry points resolve per module system", () => {
        const requireCJS = createRequire(import.meta.filename);

        // both conditions of the `exports` map must reach the factory
        const fromRequire = requireCJS("../");
        assert.equal(fromRequire, Pool);

        const pkg = requireCJS("../package.json");
        assert.equal(pkg.main, "./src/index.cts");
        assert.equal(pkg.exports["."].require.default, "./src/index.cts");
        assert.equal(pkg.exports["."].import.default, "./src/index.ts");
    });
});
