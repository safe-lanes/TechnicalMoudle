import { type AgAnnotationHandleStyles, _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import type { StartEndProperties } from '../properties/startEndProperties';
import { DivariantHandle } from './handle';
import { LinearScene } from './linearScene';
export type StartEndHandle = 'start' | 'end';
export declare abstract class StartEndScene<Datum extends StartEndProperties> extends LinearScene<Datum> {
    activeHandle?: StartEndHandle;
    protected readonly start: DivariantHandle;
    protected readonly end: DivariantHandle;
    protected anchor: _ModuleSupport.FloatingToolbarAnchor;
    update(datum: Datum, context: AnnotationContext): void;
    toggleHandles(show: boolean | Partial<Record<StartEndHandle, boolean>>): void;
    toggleActive(active: boolean): void;
    dragHandle(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    stopDragging(): void;
    getAnchor(): _ModuleSupport.FloatingToolbarAnchor;
    getCursor(): string;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    protected updateHandles(datum: Datum, coords: _ModuleSupport.Vec4, bbox?: _ModuleSupport.BBox): void;
    protected updateAnchor(_datum: Datum, coords: _ModuleSupport.Vec4, context: AnnotationContext, _bbox?: _ModuleSupport.BBox): void;
    protected getHandleCoords(_datum: Datum, coords: _ModuleSupport.Vec4, handle: StartEndHandle, _bbox?: _ModuleSupport.BBox): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: Datum, _handle?: 'start' | 'end'): AgAnnotationHandleStyles;
}
