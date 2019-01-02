var Pool = require('../../')
var co = require('coroutine')

var p = Pool(() => {
  throw new Error('Test create error')
}, 11);

co.parallel(() => {
  try {
    p((pooled) => {
      console.log('tx operation: pooled value = %s', pooled)
    })
  } catch(e) {
    console.log("Can't get pooled object - %s", e)
  }
}, p.info().maxsize /* 11 */ );