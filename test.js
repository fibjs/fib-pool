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
});

test.run(console.DEBUG);
process.exit(0);
