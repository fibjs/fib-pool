/**
 * Compile-time regression tests. This file is never executed: it exists so
 * `fibjs --check` (npm run typecheck) fails if the public types regress.
 *
 * The pooled item must stay unconstrained. `create` may return a primitive, a
 * function, or a plain object with no close/destroy/dispose member; wrapping
 * the item in a weak type used to reject all of those.
 */
import Pool from '../src/index.ts';

/* --- the item may be a primitive ------------------------------------------- */

const numbers = Pool(() => 10);
export const a: number = numbers((v) => v + 1);
export const b: number = numbers((v) => v);

const strings = Pool((name: string) => name.length);
export const c: number = strings((n) => n * 2);

/* --- the item may be a plain object with no lifecycle member --------------- */

const plain = Pool(() => ({ value: 1 }));
export const d: number = plain((o) => o.value);
export const e: number = plain('name', (o) => o.value);

/* --- the item may be a function ------------------------------------------- */

const callable = Pool(() => {
    const fn = () => 'called';
    return fn;
});
export const f: string = callable((fn) => fn());

/* --- the item may be null or undefined ------------------------------------ */

const nullable = Pool(() => null as null | { value: number });
export const g: boolean = nullable((o) => o === null);

const undefinable = Pool(() => undefined as undefined | { value: number });
export const h: boolean = undefinable((o) => o === undefined);

/* --- a class instance with a close method --------------------------------- */

class Connection {
    constructor(readonly id: number) { }
    close() { }
}

const connections = Pool(() => new Connection(7));
export const i: number = connections((conn) => conn.id);

/* --- options object: destroy receives the precise item type --------------- */

const configured = Pool({
    create: (name: string) => ({ name, id: 1 }),
    destroy: (item) => {
        const name: string | undefined = item?.name;
        const id: number | undefined = item?.id;
        return [name, id];
    },
    maxsize: 5,
    timeout: 1000,
    retry: 2,
    strict: false
});
export const j: number = configured((o) => o.id);

/* --- explicit type arguments still work ----------------------------------- */

const explicit = Pool<{ a: number }, string>(() => ({ a: 1 }));
export const k: string = explicit((o) => String(o.a));

/* --- the pool members keep their shapes ---------------------------------- */

export const l: number = connections.connections();
export const m: number = connections.info().maxsize;
export const n: number = connections.info().count;
export const o: number = connections.info().running;
export const p: number = connections.info().wait;
export const q: number = connections.info().timeout;
connections.clear();
