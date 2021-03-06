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
