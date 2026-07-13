import { _ModuleSupport } from 'ag-charts-community';
declare const ToolbarButtonProperties: typeof _ModuleSupport.ToolbarButtonProperties;
type RangesButtonValue = number | [Date | number, Date | number] | ((start: Date | number, end: Date | number) => [Date | number, Date | number]);
export declare class RangesButtonProperties extends ToolbarButtonProperties {
    value: RangesButtonValue;
}
export {};
