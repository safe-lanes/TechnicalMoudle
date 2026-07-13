import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import type { PointProperties } from '../properties/pointProperties';
import { AnnotationScene } from './annotationScene';
import { DivariantHandle } from './handle';
export declare abstract class PointScene<Datum extends PointProperties> extends AnnotationScene {
    activeHandle?: string;
    protected readonly handle: DivariantHandle;
    protected dragState?: {
        offset: _ModuleSupport.Vec2;
        handle: _ModuleSupport.Vec2;
    };
    protected anchor: _ModuleSupport.FloatingToolbarAnchor;
    update(datum: Datum, context: AnnotationContext): void;
    dragStart(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    drag(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    translate(datum: Datum, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    toggleHandles(show: boolean | Partial<Record<'handle', boolean>>): void;
    toggleActive(active: boolean): void;
    stopDragging(): void;
    copy(datum: Datum, copiedDatum: Datum, context: AnnotationContext): Datum;
    getAnchor(): _ModuleSupport.FloatingToolbarAnchor;
    getCursor(): string;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    protected updateHandle(datum: Datum, point: _ModuleSupport.Vec2, bbox?: _ModuleSupport.BBox): void;
    protected updateAnchor(datum: Datum, point: _ModuleSupport.Vec2, context: AnnotationContext): {
        x: number;
        y: number;
        position: "right" | "above" | "above-left" | "below" | undefined;
    };
    protected getHandleCoords(_datum: Datum, point: _ModuleSupport.Vec2, _bbox?: _ModuleSupport.BBox): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: Datum): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
}
