import { _ModuleSupport } from 'ag-charts-community';
import type { PointProperties } from '../annotationProperties';
import type { AnnotationContext } from '../annotationTypes';
import { AnnotationScene } from './annotationScene';
export declare abstract class LinearScene<Datum extends {
    start: Pick<PointProperties, 'x' | 'y'>;
    end: Pick<PointProperties, 'x' | 'y'>;
    extendStart?: boolean;
    extendEnd?: boolean;
    locked?: boolean;
}> extends AnnotationScene {
    protected dragState?: {
        offset: _ModuleSupport.Vec2;
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
    };
    protected overflowContinuous: number;
    protected extendLine({ x1, y1, x2, y2 }: _ModuleSupport.Vec4, datum: Datum, context: AnnotationContext): {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    dragStart(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    drag(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    protected abstract dragHandle(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    protected dragAll(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    translate(datum: Datum, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    copy(datum: Datum, copiedDatum: Datum, context: AnnotationContext): Datum | undefined;
    protected translatePoints(datum: Datum, start: _ModuleSupport.Vec2, end: _ModuleSupport.Vec2, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    protected getTranslatePointsVectors(start: _ModuleSupport.Vec2, end: _ModuleSupport.Vec2): {
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
    };
}
