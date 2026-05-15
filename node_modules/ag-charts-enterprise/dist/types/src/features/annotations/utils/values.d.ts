import type { _ModuleSupport } from 'ag-charts-community';
import type { PointProperties } from '../annotationProperties';
import type { AnnotationAxisContext, AnnotationContext, Point } from '../annotationTypes';
export declare function convertLine(datum: {
    start: Pick<PointProperties, 'x' | 'y'>;
    end: Pick<PointProperties, 'x' | 'y'>;
}, context: AnnotationContext): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
} | undefined;
export declare function convertPoint(point: Point, context: AnnotationContext): {
    x: number;
    y: number;
};
export declare function convert(p: Point['x' | 'y'], context: Pick<AnnotationAxisContext, 'scale' | 'snapToGroup'>): number;
export declare function invertCoords(coords: _ModuleSupport.Vec2, context: AnnotationContext): {
    x: any;
    y: any;
};
export declare function invert(n: _ModuleSupport.Vec2['x' | 'y'], context: Pick<AnnotationAxisContext, 'scale' | 'continuous' | 'scaleInvert' | 'scaleInvertNearest'>): any;
