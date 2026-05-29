import type { AgAnnotationLineStyleType, _ModuleSupport } from 'ag-charts-community';
import type { PointType } from './utils/scale';
export type Constructor<T = object> = new (...args: any[]) => T;
export declare enum AnnotationType {
    Line = "line",
    HorizontalLine = "horizontal-line",
    VerticalLine = "vertical-line",
    DisjointChannel = "disjoint-channel",
    ParallelChannel = "parallel-channel",
    FibonacciRetracement = "fibonacci-retracement",
    FibonacciRetracementTrendBased = "fibonacci-retracement-trend-based",
    Callout = "callout",
    Comment = "comment",
    Note = "note",
    Text = "text",
    Arrow = "arrow",
    ArrowUp = "arrow-up",
    ArrowDown = "arrow-down",
    DateRange = "date-range",
    PriceRange = "price-range",
    DatePriceRange = "date-price-range",
    QuickDatePriceRange = "quick-date-price-range"
}
type TextualAnnotationType = AnnotationType.Callout | AnnotationType.Comment | AnnotationType.Note | AnnotationType.Text;
type LineAnnotationType = AnnotationType.Line | AnnotationType.HorizontalLine | AnnotationType.VerticalLine | AnnotationType.Arrow;
type ChannelAnnotationType = AnnotationType.DisjointChannel | AnnotationType.ParallelChannel;
type MeasurerAnnotationType = AnnotationType.DateRange | AnnotationType.PriceRange | AnnotationType.DatePriceRange | AnnotationType.QuickDatePriceRange;
type EphemeralAnnotationType = AnnotationType.QuickDatePriceRange;
export type FibonacciAnnotationType = AnnotationType.FibonacciRetracement | AnnotationType.FibonacciRetracementTrendBased;
export type HasColorAnnotationType = AnnotationType;
export type HasLineStyleAnnotationType = Exclude<LineAnnotationType | ChannelAnnotationType | MeasurerAnnotationType, EphemeralAnnotationType>;
export type HasLineTextAnnotationType = Exclude<LineAnnotationType | ChannelAnnotationType | MeasurerAnnotationType, EphemeralAnnotationType>;
export type HasFontSizeAnnotationType = Exclude<Exclude<TextualAnnotationType, AnnotationType.Note> | LineAnnotationType | ChannelAnnotationType | MeasurerAnnotationType, EphemeralAnnotationType>;
export declare function stringToAnnotationType(value: unknown): AnnotationType | undefined;
export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Point {
    x?: PointType;
    y?: PointType;
}
export interface Padding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export type FibonacciBands = 10 | 6 | 4;
export interface AnnotationAxisContext extends Pick<_ModuleSupport.AxisContext, 'continuous' | 'direction' | 'position' | 'scale' | 'scaleInvert' | 'scaleInvertNearest' | 'formatScaleValue' | 'attachLabel' | 'inRange' | 'getRangeOverflow'> {
    bounds: _ModuleSupport.BBox;
    labelPadding: number;
    snapToGroup: boolean;
}
export type AnnotationContext = {
    seriesRect: _ModuleSupport.BBox;
    xAxis: AnnotationAxisContext;
    yAxis: AnnotationAxisContext;
};
export type AnnotationOptionsColorPickerType = 'line-color' | 'fill-color' | 'text-color';
export type FibonacciAnnotationToolbarOptionsType = {
    bands?: FibonacciBands;
    reverse?: boolean;
    showFill?: boolean;
};
export type AnnotationLineStyle = {
    type?: AgAnnotationLineStyleType;
    strokeWidth?: number;
};
export type LineTextAlignment = 'left' | 'center' | 'right';
export type LineTextPosition = 'top' | 'center' | 'bottom';
export type ChannelTextPosition = 'top' | 'inside' | 'bottom';
export {};
