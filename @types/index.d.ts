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
    type FibPoolRetryCountType = number
    interface FibPoolOptionResult {
        create: FibPoolOptionCreator
        destroy: FibPoolOptionDestoryor
        maxsize: number
        timeout: number
        retry: FibPoolRetryCountType
    }
    interface FibPoolOptionGenerator {
        (): FibPoolOptionResult;
    }
    type FibPoolOptsArg = FibPoolOptionResult | FibPoolOptionCreator

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
    type FibPoolInnerErr = any

    interface FibPoolFunction<DippedItem = any> {
        (name: string|FibPoolDipperFn<DippedItem>, o?: FibPoolDipperFn<DippedItem>): DippedItem
        connections?(): number;
        info?(): FibPoolInfo; 
        clear?(): void;
    }
    interface FibPoolObjectToExtract {
        close?: Function;
        destroy?: Function;
        dispose?: Function;
    }

    interface FibPoolDipperFn<DippedItem> {
        (o: DippedItem): DippedItem
    }

    interface FibPoolGenerator<DippedItem = any> {
        (opt: FibPoolOptsArg, maxsize: number, timeout: number): FibPoolNS.FibPoolFunction<DippedItem>
    }
}

declare module "fib-pool" {
    const mod: FibPoolNS.FibPoolGenerator
    export = mod
}
