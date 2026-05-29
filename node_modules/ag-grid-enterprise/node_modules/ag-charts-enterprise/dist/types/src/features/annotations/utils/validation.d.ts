import { type Direction } from 'ag-charts-community';
import type { AnnotationContext, Point } from '../annotationTypes';
export declare function validateDatumLine(context: AnnotationContext, datum: {
    start: Point;
    end: Point;
}, options?: {
    overflowContinuous: boolean;
}, warningPrefix?: string): boolean;
export declare function validateDatumValue(context: AnnotationContext, datum: {
    value?: Point['x' | 'y'];
    direction?: Direction;
}, warningPrefix?: string): boolean;
export declare function validateDatumPoint(context: AnnotationContext, point: Point, options?: {
    overflowContinuous: boolean;
}, warningPrefix?: string): boolean;
export declare function isPoint(point: Point | undefined): point is Point;
