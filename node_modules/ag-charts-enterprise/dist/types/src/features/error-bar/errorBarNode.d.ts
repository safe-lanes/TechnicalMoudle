import type { AgErrorBarOptions, AgErrorBarThemeableOptions } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { HighlightState } from 'ag-charts-types';
type NearestResult<T> = _ModuleSupport.NearestResult<T>;
export type ErrorBarNodeDatum = _ModuleSupport.CartesianSeriesNodeDatum & _ModuleSupport.ErrorBoundSeriesNodeDatum;
export type ErrorBarStylingOptions = Omit<AgErrorBarThemeableOptions, 'cap'>;
type FormatOptions = Pick<AgErrorBarOptions<any>, 'xLowerKey' | 'xUpperKey' | 'yLowerKey' | 'yUpperKey' | 'itemStyler'>;
type Caller = {
    callWithContext<I, O, F extends (params: I) => O>(callback: F, params: I): O;
    callWithContext<I, O, F extends (params: I) => O | undefined>(callback: F, params: I): O | undefined;
};
export declare class ErrorBarNode extends _ModuleSupport.Group {
    private readonly whiskerPath;
    private readonly capsPath;
    private capLength;
    private readonly bboxes;
    protected _datum: ErrorBarNodeDatum | undefined;
    get datum(): ErrorBarNodeDatum | undefined;
    set datum(datum: ErrorBarNodeDatum | undefined);
    constructor();
    private calculateCapLength;
    private getItemStylerParams;
    private formatStyles;
    private applyStyling;
    update(style: AgErrorBarThemeableOptions, formatters: FormatOptions, caller: Caller, highlighted: boolean, highlightState: HighlightState): void;
    updateBBoxes(): void;
    containsPoint(x: number, y: number): boolean;
    pickNode(x: number, y: number): _ModuleSupport.Node | undefined;
    nearestSquared(x: number, y: number, maxDistance: number): NearestResult<_ModuleSupport.Node>;
}
export declare class ErrorBarGroup extends _ModuleSupport.Group {
    nearestSquared(x: number, y: number): _ModuleSupport.PickNodeDatumResult;
}
export {};
