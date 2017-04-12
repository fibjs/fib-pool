## Generic resource pooling for fibjs

[![Build Status](https://travis-ci.org/fibjs/fib-pool.svg)](https://travis-ci.org/fibjs/fib-pool)

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
```JavaScript
var db = require("db");
var Pool = require("fib-pool");

var p = Pool(() => {
    return db.open("sqlite:test.db");
});
```
Specify maxsize and timeout.
```JavaScript
var db = require("db");
var Pool = require("fib-pool");

var p = Pool(() => {
    return db.open("sqlite:test.db");
}, 10, 30 * 1000);
```
Specify custom destroy function.
```JavaScript
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
```JavaScript
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

p((conn) => {
    conn.execute("delect * from test");
});

```

## Using the pool with name
```JavaScript
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

p("test", (conn) => {
    conn.execute("delect * from test");
});

```
