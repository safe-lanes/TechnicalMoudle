import { type AgAnnotationLineStyleType, _ModuleSupport } from 'ag-charts-community';
import { AnnotationType } from './annotationTypes';
export declare enum AnnotationOptions {
    Delete = "delete",
    LineStrokeWidth = "line-stroke-width",
    LineStyleType = "line-style-type",
    LineColor = "line-color",
    FillColor = "fill-color",
    Lock = "lock",
    TextColor = "text-color",
    TextSize = "text-size",
    Settings = "settings"
}
export declare const LINE_ANNOTATION_ITEMS: (_ModuleSupport.MenuItem<AnnotationType> & {
    visible?: (axisScale: _ModuleSupport.Scale<any, any>) => boolean;
})[];
export declare const FIBONACCI_ANNOTATION_ITEMS: _ModuleSupport.MenuItem<AnnotationType>[];
export declare const FIBONACCI_RATIO_ITEMS: _ModuleSupport.MenuItem<number>[];
export declare const TEXT_ANNOTATION_ITEMS: _ModuleSupport.MenuItem<AnnotationType>[];
export declare const SHAPE_ANNOTATION_ITEMS: _ModuleSupport.MenuItem<AnnotationType>[];
export declare const MEASURER_ANNOTATION_ITEMS: _ModuleSupport.MenuItem<AnnotationType>[];
export declare const LINE_STROKE_WIDTH_ITEMS: _ModuleSupport.MenuItem<number>[];
export declare const LINE_STYLE_TYPE_ITEMS: _ModuleSupport.MenuItem<AgAnnotationLineStyleType>[];
export declare const TEXT_SIZE_ITEMS: _ModuleSupport.MenuItem<number>[];
