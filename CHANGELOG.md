
v1.4.1 / 2018-06-19
==================

  * add 'types' field to package.json

v1.4.0 / 2018-06-17
===================

  * 1.4.0
  * upgrade version of '@fibjs/ci'
  * add npm badget to README.md
  * typify
  * support running in info.
  * v1.3.0
  * 重构代码，减少不必要的闭包
  * 通过设定超时清理 pool
  * Merge pull request #6 from wf744/fib-pool-bugfix
  * 修复mongodb3.0关闭连接时报错o.destroy is not a function
  * ver 1.2.0
  * Optimized for long time create.
  * modify readme.
  * ver 1.1
  * Merge pull request #5 from anlebcoder/master
  * tips:` p.length = 0` or `p = []` or `p.length = []` fix: pools code
  * 1. update readme 2. pool depends clear all conn 3. update pool`s clear function case;
  * 1. index.js: pool增加clear方法，释放所有的池内对象 2. test.js: 增加pool的clear测试用例
  * 1. format code: Delimiter change `Tab`
  * 更新版本号
  * Merge pull request #2 from anlebcoder/master
  * update:增加pool池获取create对象未break的bug 测试用例
  * fix:pool内有create对象时，从pool池获取，并且获取一个之后直接break循环
  * 增加 maxsize 测试用例
  * 销毁对象前判断 o 是否为 undefined
  * Merge pull request #1 from fibjs/doc
  * doc:update readme
  * 支持连接重试
  * 更新 ci 地址
  * 更新版本号
  * 更新 repository 地址
  * 修正 readme 错误
  * 修改版本号
  * pool 支持命名
  * 修改 ci 命令
  * init
