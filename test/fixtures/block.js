var Pool = require('../../')
var co = require('coroutine')

var p = Pool(() => {
  throw new Error('Test create error')
});

// uncomment below to see fibers before process exit.
// var timer;
// timer = setInterval(() => {
//     console.log('current fibers', co.fibers)
//     clearInterval(timer);
// }, 1000)

co.parallel(() => {
  try {
    p((pooled) => {
      console.log('tx operation: pooled value = %s', pooled)
    })
  } catch(e) {
    console.log("Can't get pooled object - %s", e)
  }
}, 10);