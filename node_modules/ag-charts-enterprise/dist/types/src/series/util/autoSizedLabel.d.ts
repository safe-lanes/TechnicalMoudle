import { _ModuleSupport } from 'ag-charts-community';
import type { OverflowStrategy, TextWrap } from 'ag-charts-types';
declare class BaseAutoSizedLabel<FormatterParams> extends _ModuleSupport.Label<FormatterParams> {
    wrapping: TextWrap;
    overflowStrategy: OverflowStrategy;
    lineHeight?: number;
    minimumFontSize?: number;
}
export declare class AutoSizedLabel<FormatterParams> extends BaseAutoSizedLabel<FormatterParams> {
    spacing: number;
}
export declare class AutoSizedSecondaryLabel<FormatterParams> extends BaseAutoSizedLabel<FormatterParams> {
}
export {};
