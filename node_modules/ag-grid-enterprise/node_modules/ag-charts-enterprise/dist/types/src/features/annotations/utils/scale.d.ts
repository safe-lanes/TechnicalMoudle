type ValueType = number | string | Date | undefined;
export type GroupingValueType = {
    value: ValueType;
    groupPercentage: number;
};
export type PointType = ValueType | GroupingValueType;
export declare function getGrouping(d: PointType | undefined): GroupingValueType;
export declare function getGroupingValue(d: PointType | undefined): ValueType;
export {};
