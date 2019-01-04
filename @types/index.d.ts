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

    interface FibPoolOptionCreator {
        (name: string): FibPoolPayloadObject;
    }
    interface FibPoolOptionDestoryor {
        (): void;
    }
    type FibPoolRetryCountType = number | boolean
    interface FibPoolOptionArgs {
        create?: FibPoolOptionCreator
        destroy?: FibPoolOptionDestoryor
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

    type FibPoolPayloadObject = object
    interface FibPoolUnit {
        o: FibPoolPayloadObject;
        name: string;
        time: Date;
    }
    type FibPoolInnerJobName = string;
    interface FibPoolInnerJob {
        name: FibPoolInnerJobName;
        ev: Class_Event;
        o?:FibPoolPayloadObject;
        // Error
        e?: FibPoolInnerErr;
    }
    type FibPoolInnerErr = Error;

    interface FibPoolDipperFn<DippedItem = any, RETURN_TYPE = any> {
        (o: DippedItem): RETURN_TYPE
    }
    type FibPoolCallback<T = any, T2 = any> = FibPoolDipperFn<T, T2>

    interface FibPoolFunction<DippedItem = any, RETURN_TYPE = any> {
        (name: string, o: FibPoolCallback<DippedItem, RETURN_TYPE>): RETURN_TYPE
        (o: FibPoolCallback<DippedItem, RETURN_TYPE>): RETURN_TYPE
        connections?(): number;
        info?(): FibPoolInfo; 
        clear?(): void;
    }
    interface FibPoolObjectToExtract {
        close?: Function;
        destroy?: Function;
        dispose?: Function;
    }

    interface FibPoolGenerator<DippedItem = any> {
        (opt: FibPoolOptsArg, maxsize?: number, timeout?: number): FibPoolNS.FibPoolFunction<DippedItem>
    }
}

declare module "fib-pool" {
    const mod: FibPoolNS.FibPoolGenerator
    export = mod
}
