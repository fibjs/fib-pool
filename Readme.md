## Generic resource pooling for fibjs

[![NPM version](https://img.shields.io/npm/v/fib-pool.svg)](https://www.npmjs.org/package/fib-pool)
[![Build Status](https://travis-ci.org/fibjs/fib-pool.svg)](https://travis-ci.org/fibjs/fib-pool)
[![Build status](https://ci.appveyor.com/api/projects/status/p662f7ulpc4asu8s?svg=true)](https://ci.appveyor.com/project/richardo2016/fib-pool)

## Install

```sh
npm install fib-pool [--save]
```

## Test

```sh
npm run ci
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

When strict mode is enabled, it also prevents:
- Setting properties on pooled objects
- Calling `close()`, `destroy()`, or `dispose()` methods directly

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
