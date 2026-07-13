import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext, Point } from '../annotationTypes';
export declare function snapPoint(offset: _ModuleSupport.Vec2, context: AnnotationContext, snapping?: boolean, origin?: Point, angleStep?: number): {
    x: any;
    y: any;
};
export declare function snapToAngle(vector: _ModuleSupport.Vec2, center: _ModuleSupport.Vec2, step: number): _ModuleSupport.Vec2;
export declare function getDragStartState<PointName extends string>(points: Record<PointName, Point>, context: AnnotationContext): Record<PointName, _ModuleSupport.Vec2>;
/**
 * Translate an collection of vectors by the given translation. Clamp the vectors as a group within the series area.
 *
 * @param vectors The collection of vectors to translate.
 * @param translation The translation to apply to the vectors.
 * @param context Annotation context.
 * @param options.overflowContinuous The tolerance for how many vectors can overflow before the group is clamped.
 * @param options.snap Snap by which vector and at what angle.
 * @param options.translateVectors Which vectors should be considered as currently translating.
 * @param options.invertYVectors Invert the y-axis translation for these vectors.
 * @returns A collection of translated points in domain space.
 */
export declare function translate<VectorName extends string>(vectors: Record<VectorName, _ModuleSupport.Vec2>, translation: _ModuleSupport.Vec2, context: AnnotationContext, options?: {
    overflowContinuous: number;
    translateVectors?: VectorName[];
    invertYVectors?: VectorName[];
    snap?: {
        vectors: Record<VectorName, _ModuleSupport.Vec2>;
        angle: number;
    };
}): Record<VectorName, _ModuleSupport.Vec2>;
