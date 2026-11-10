## Generic resource pooling for fibjs

[![NPM version](https://img.shields.io/npm/v/fib-pool.svg)](https://www.npmjs.org/package/fib-pool)

## Install

```sh
npm install fib-pool [--save]
```

## Test

```sh
npm test        # fibjs test
npm run typecheck   # fibjs --check
```

## Creating a pool

Simple example.

```js
var db = require("db");
var Pool = require("fib-pool");

var p = Pool(() => {
    return db.open("sqlite:test.db");
});
```

Specify maxsize and timeout.

```js
var db = require("db");
var Pool = require("fib-pool");

var p = Pool(() => {
    return db.open("sqlite:test.db");
}, 10, 30 * 1000);
```

Specify custom destroy function.

```js
var db = require("db");
var Pool = require("fib-pool");

var p = Pool({
    create: () => {
        return db.open("sqlite:test.db");
    },
    destroy: (o) => {
        o.close()
    },
    timeout: 30 * 1000,
    retry: 3
});
```

## Using the pool

```js
var db = require("db");
var Pool = require("fib-pool");

var p = Pool({
    create: () => {
        return db.open("sqlite:test.db");
    },
    destroy: (o) => {
        o.close()
    },
    timeout: 30 * 1000,
    retry: 3
});

var res = p((conn) => {
    conn.execute("select * from test");
});

```

## Using the pool with name

```js
var db = require("db");
var Pool = require("fib-pool");

var p = Pool({
    create: (name) => {
        return db.open("sqlite:" + name + ".db");
    },
    destroy: (o) => {
        o.close()
    },
    timeout: 30 * 1000
});

var res = p("test", (conn) => {
    conn.execute("select * from test");
});

```

## Options

| option | type | default | notes |
|---|---|---|---|
| `create` | `(name) => item` | — | required; throwing is a failure, retried up to `retry` times |
| `destroy` | `(item) => void` | close/destroy/dispose | defaults to calling whichever of those three the item provides |
| `maxsize` | positive integer | `10` | caps both concurrency and the number of idle items |
| `timeout` | positive number (ms) | `60000` | how long an idle item is kept |
| `retry` | positive integer | `1` | how many times `create` is attempted before giving up |
| `strict` | boolean | `true` | see below |

Invalid `maxsize`, `timeout` and `retry` values throw a `TypeError` when the
pool is created rather than being silently coerced:

```js
Pool({ create: () => ({}), maxsize: 0 });      // TypeError: maxsize must be a positive integer, received 0
Pool({ create: () => ({}), timeout: -5 });     // TypeError: timeout must be a positive number, received -5
Pool({ create: () => ({}), retry: true });     // TypeError: retry must be a positive integer, received true
```

The idle list is capped by `maxsize` as well: a pool used with more names than
that evicts the least recently used item (and destroys it) instead of keeping
one idle item per name.

## Reentrancy

A pool cannot be acquired twice from the same fiber. The inner call would wait
for a permit that the outer call is holding, which never arrives, so it is
rejected instead of deadlocking:

```js
var p = Pool({ create: () => ({}), maxsize: 1 });

p(() => {
    p(() => {}); // Error: Cannot pool again from the same fiber
});
```

Nesting different pools, or acquiring the same pool from another fiber, works as
expected.

## Strict mode (default: enabled)

By default, the pool uses strict mode to prevent accessing pooled objects outside of the callback function. This helps prevent resource leaks and ensures proper resource management.

```js
var Pool = require("fib-pool");

var p = Pool({
    create: () => {
        return { value: 1, getValue: function() { return this.value; } };
    }
});

var leaked;
p((obj) => {
    leaked = obj;
    // This works inside the pool callback
    console.log(obj.getValue()); // OK
});

// This will throw an error: "access object outside of pool scope"
leaked.getValue(); // Error!
```

The guarded object behaves like the item for reading and inspection —
`key in obj`, `Object.keys(obj)`, `for...in`, `JSON.stringify(obj)` and
`util.inspect(obj)` all report the item's own members — while the guards remain:

- Setting properties on pooled objects
- Calling `close()`, `destroy()`, or `dispose()` methods directly
- Extracting a method and calling it after the callback returned

To disable strict mode:

```js
var p = Pool({
    create: () => {
        return { value: 1 };
    },
    strict: false
});
```

## Clear a pool

Simple example.

```js
var db = require("db");
var Pool = require("fib-pool");

var p = Pool(() => {
    return db.open("sqlite:test.db");
});

p.clear();
```
