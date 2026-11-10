/**
 * CommonJS entry point.
 *
 * The pool is implemented in `index.ts` as an ES module, so requiring that
 * file yields the module namespace object (`{ default, __esModule }`) rather
 * than the factory. Callers of `require('fib-pool')` expect the export to *be*
 * the factory function, so this bridge unwraps the default export.
 *
 * A static `import` is not an option here: this file is CommonJS, so it must
 * load the implementation through `require` to get the namespace object.
 *
 * `module.exports =` is used instead of `export =` because fibjs runs
 * TypeScript in strip-only mode, which rejects export assignments. The type of
 * this file is described by the sibling `index.d.cts`.
 */
const impl = require('./index.ts');

module.exports = impl.default;
