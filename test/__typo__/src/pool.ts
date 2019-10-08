import GetPool = require('fib-pool')

var pool1 = GetPool<any, {foo: string}>((name) => {
    return {
        destroy() { return null }
    }
})

var pool1_r1 = pool1('abc', (o) => {
    return {foo: 'bar'}
})
var pool1_r2 = pool1<{foo_: 'bar'}>(o => {
    return {foo_: 'bar'}
})

pool1.clear()

var pool2 = GetPool<any, {foo2: string}>({
    create (name) {
        return {}
    },
    destroy () {}
})

var pool2_r1 = pool2('abc', (o) => {
    return {foo2: 'bar'}
})
var pool2_r2 = pool2<{foo2: 'bar'}>(o => {
    return {foo2: 'bar'}
})

var count: number = pool2.connections()
var info = pool2.info()

pool2.clear()