/// <reference types="@fibjs/types" />

declare namespace FibPoolNS {
    type FirstParameter<T> = T extends (arg: infer T, ...args: any[]) => any ? T : never; 

    interface DippedItemStruct {
        close?: FibPoolOptionResult['destroy'];
        destroy?: FibPoolOptionResult['destroy'];
        dispose?: FibPoolOptionResult['destroy'];
    }

    interface FibPoolOptionArgs<T extends DippedItemStruct = Fibjs.AnyObject> {
        create: (name: string) => T
        destroy?: (item?: T) => any;
        maxsize?: number
        timeout?: number
        retry?: number | boolean
    }
    interface FibPoolOptionResult<T extends DippedItemStruct = Fibjs.AnyObject> {
        create: FibPoolOptionArgs<T>['create']
        destroy: FibPoolOptionArgs<T>['destroy']
        maxsize: FibPoolOptionArgs<T>['maxsize']
        timeout: FibPoolOptionArgs<T>['timeout']
        retry: FibPoolOptionArgs<T>['retry']
    }

    interface FibPoolDipperFn<T_CREATED_ITEM, T_POOL_FUNC_RETURN = any> {
        (o: T_CREATED_ITEM): T_POOL_FUNC_RETURN
    }

    type FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN = any> = {
        <T_RETURN = T_POOL_FUNC_RETURN>(name: string, func: FibPoolDipperFn<T_CREATED_ITEM, T_RETURN>): T_RETURN
        <T_RETURN = T_POOL_FUNC_RETURN>(func: FibPoolDipperFn<T_CREATED_ITEM, T_RETURN>): T_RETURN
    } & {
        connections?(): number;
        info?(): {
            maxsize: number;
            count: number;
            running: number;
            wait: number;
            timeout: number;
        }; 
        clear?(): void;
    }

    function FibPoolGenerator<
        T_CREATED_ITEM extends DippedItemStruct = Fibjs.AnyObject,
        T_POOL_FUNC_RETURN = any
    > (
        opt: FibPoolOptionArgs<T_CREATED_ITEM> | FibPoolOptionArgs<T_CREATED_ITEM>['create'],
        maxsize?: number,
        timeout?: number
    ): FibPool<T_CREATED_ITEM, T_POOL_FUNC_RETURN>;
}

declare module "fib-pool" {
    export = FibPoolNS.FibPoolGenerator
}
