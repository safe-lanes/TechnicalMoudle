import type { AggregatePropertyDefinition, DatumPropertyDefinition } from './dataModel';
export declare function sumValues(values: any[], accumulator?: [number, number]): [number, number];
export declare function sum(id: string, matchGroupId: string): AggregatePropertyDefinition<any, any>;
export declare function groupSum(id: string, opts?: {
    matchGroupId?: string;
    visible?: boolean;
}): AggregatePropertyDefinition<any, any>;
export declare function range(id: string, matchGroupId: string): AggregatePropertyDefinition<any, any>;
export declare function groupCount(id: string, opts?: {
    visible?: boolean;
}): AggregatePropertyDefinition<any, any>;
export declare function groupAverage(id: string, opts?: {
    matchGroupId?: string;
    visible?: boolean;
}): AggregatePropertyDefinition<any, any, [number, number], [number, number, number]>;
export declare function area(id: string, aggFn: AggregatePropertyDefinition<any, any>, matchGroupId?: string): AggregatePropertyDefinition<any, any>;
export declare function accumulatedValue(onlyPositive?: boolean): DatumPropertyDefinition<any>['processor'];
export declare function trailingAccumulatedValue(): DatumPropertyDefinition<any>['processor'];
