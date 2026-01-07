import { describe, it, afterEach } from "node:test";
import assert from "assert";
import coroutine from "coroutine";

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
});
