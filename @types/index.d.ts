/// <reference types="fibjs" />

declare namespace FibPoolNS {
    interface FibPoolInfo {
        maxsize: number;
        count: number;
        // boolean-type number
        running: number;
        wait: number;
        timeout: number;
    }

    interface FibPoolOptionCreator<T = FibPoolPayloadObject> {
        (name: string): T;
    }
    interface FibPoolOptionDestoryor<T = any> {
        (item?: T): void;
    }
    type FibPoolRetryCountType = number | boolean
    interface FibPoolOptionArgs<T = any> {
        create?: FibPoolOptionCreator
        destroy?: FibPoolOptionDestoryor<T>
        maxsize?: number
        timeout?: number
        retry?: FibPoolRetryCountType
    }
    interface FibPoolOptionResult {
        create: FibPoolOptionCreator
        destroy: FibPoolOptionDestoryor
        maxsize: number
        timeout: number
        retry: FibPoolRetryCountType
    }
    type FibPoolOptsArg = FibPoolOptionArgs | FibPoolOptionCreator

    type FibPoolPayloadObject = any
    interface FibPoolUnit<T = FibPoolPayloadObject> {
        o: T;
        name: string;
        time: Date;
    }
    type FibPoolInnerJobName = string;
    interface FibPoolInnerJob<T = FibPoolPayloadObject> {
        name: FibPoolInnerJobName;
        ev: Class_Event;
        o?: T;
        // Error
        e?: FibPoolInnerErr;
    }
    type FibPoolInnerErr = Error;

    interface FibPoolDipperFn<DippedItem = FibPoolPayloadObject, RETURN_TYPE = any> {
        (o: DippedItem): RETURN_TYPE
    }
    type FibPoolCallback<T = any, T2 = any> = FibPoolDipperFn<T, T2>

    interface FibPoolFunction<DippedItem = FibPoolPayloadObject, RETURN_TYPE = any> {
        (name: string, o: FibPoolCallback<DippedItem, RETURN_TYPE>): RETURN_TYPE
        (o: FibPoolCallback<DippedItem, RETURN_TYPE>): RETURN_TYPE
        connections?(): number;
        info?(): FibPoolInfo; 
        clear?(): void;
    }
    interface FibPoolObjectToExtract {
        close?: FibPoolOptionResult['destroy'] | Function;
        destroy?: FibPoolOptionResult['destroy'] | Function;
        dispose?: FibPoolOptionResult['destroy'] | Function;
    }

    function FibPoolGenerator<DippedItem = FibPoolPayloadObject> (opt: FibPoolOptsArg, maxsize?: number, timeout?: number): FibPoolNS.FibPoolFunction<DippedItem>;
}

declare module "fib-pool" {
    export = FibPoolNS.FibPoolGenerator
}
