var test = require("test");
test.setup();

var coroutine = require("coroutine");

var Pool = require(".");

describe("pool", () => {
    it("run", () => {
        var p = Pool(() => {
            return 10;
        });

        assert.equal(p((v) => {
            return v + 1;
        }), 11);
    });

    it("pool", () => {
        var n = 0;

        var p = Pool(() => {
            n++;
            return n;
        });

        assert.equal(p((v) => {
            return v + 1;
        }), 2);
    });

    it("maxsize", () => {
        var n = 0;
        var m = 0;

        var p = Pool(() => {
            // n++;
            return n;
        }, 10);

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

        var p = Pool(() => {
            n++;
            return n;
        });

        assert.equal(p((v) => {
            return v + 1;
        }), 2);

        assert.throws(() => {
            p((v) => {
                throw "error";
            });
        });

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

        assert.throws(() => {
            p((v) => {
                throw "error";
            });
        });

        assert.isFalse(called);
        coroutine.sleep(10);
        assert.isTrue(called);
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

        p2((v) => {});

        assert.equal(n2, 3);
    });

    it("maxsize and create",function(){
        var createCount = 0,
            maxsize = 2;

        var p = Pool({
            create: () => {
                createCount++;
                return {};
            },
            maxsize: maxsize
        });

        coroutine.parallel(["a","b","c","d"], function(n){
            p((n) => {
                coroutine.sleep(50);
            })
        });

        assert.equal(createCount, maxsize);
    });

    it("clear", function() {
        function parallel(data) {
            coroutine.parallel(data, function(n) {
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

        parallel(["a", "b", "c", "d"]);

        assert.equal(p.info().count, maxsize);

        p.clear();

        assert.equal(p.info().count, 0);

        parallel(["a"]);

        assert.equal(p.info().count, 1);

        p.clear();

        assert.equal(p.info().count, 0);

    });
});

process.exit(test.run(console.DEBUG));