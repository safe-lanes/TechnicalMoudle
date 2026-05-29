import { type AgAnnotationLineStyleType, _ModuleSupport } from 'ag-charts-community';
import { type AnnotationLineStyle, type AnnotationOptionsColorPickerType, AnnotationType, type ChannelTextPosition, type FibonacciAnnotationToolbarOptionsType, type FibonacciAnnotationType, type HasColorAnnotationType, type HasFontSizeAnnotationType, type HasLineStyleAnnotationType, type HasLineTextAnnotationType, type LineTextAlignment, type LineTextPosition } from './annotationTypes';
import type { AnnotationProperties } from './annotationsSuperTypes';
interface DefaultsMemento {
    colors: DefaultColors;
    fontSizes: DefaultFontSizes;
    lineStyles: DefaultLineStyles;
    lineTextAlignments: DefaultLineTextAlignments;
    lineTextPositions: DefaultLineTextPositions;
    fibonacciOptions: DefaultFibonacciOptions;
}
type DefaultColors = Map<AnnotationType, Map<AnnotationOptionsColorPickerType, [string, string, number, boolean] | undefined>>;
type DefaultFontSizes = Map<HasFontSizeAnnotationType, number | undefined>;
type DefaultLineStyles = Map<HasLineStyleAnnotationType, AnnotationLineStyle | undefined>;
type DefaultLineTextAlignments = Map<HasLineTextAnnotationType, LineTextAlignment | undefined>;
type DefaultLineTextPositions = Map<HasLineTextAnnotationType, LineTextPosition | ChannelTextPosition | undefined>;
type DefaultFibonacciOptions = Map<FibonacciAnnotationType, FibonacciAnnotationToolbarOptionsType>;
export declare class AnnotationDefaults implements _ModuleSupport.MementoOriginator<DefaultsMemento> {
    mementoOriginatorKey: "annotation-defaults";
    private colors;
    private fontSizes;
    private lineStyles;
    private lineTextAlignments;
    private lineTextPositions;
    private fibonacciOptions;
    createMemento(): {
        colors: DefaultColors;
        fontSizes: DefaultFontSizes;
        lineStyles: DefaultLineStyles;
        lineTextAlignments: DefaultLineTextAlignments;
        lineTextPositions: DefaultLineTextPositions;
        fibonacciOptions: DefaultFibonacciOptions;
    };
    guardMemento(_blob: unknown): _blob is DefaultsMemento;
    restoreMemento(_version: string, _mementoVersion: string, blob: DefaultsMemento): void;
    setDefaultColor(type: HasColorAnnotationType, colorType: AnnotationOptionsColorPickerType, colorOpacity: string, color: string, opacity: number, isMultiColor: boolean): void;
    setDefaultFontSize(type: HasFontSizeAnnotationType, fontSize: number): void;
    setDefaultLineStyleType(type: HasLineStyleAnnotationType, lineStyleType: AgAnnotationLineStyleType | undefined): void;
    setDefaultLineStyleWidth(type: HasLineStyleAnnotationType, strokeWidth: number): void;
    setDefaultLineTextAlignment(type: HasLineTextAnnotationType, alignment: LineTextAlignment): void;
    setDefaultLineTextPosition(type: HasLineTextAnnotationType, position: LineTextPosition | ChannelTextPosition): void;
    setDefaultFibonacciOptions<K extends keyof FibonacciAnnotationToolbarOptionsType>(type: FibonacciAnnotationType | HasLineStyleAnnotationType, key: K, value: FibonacciAnnotationToolbarOptionsType[K]): void;
    applyDefaults(datum: AnnotationProperties): void;
}
export {};
