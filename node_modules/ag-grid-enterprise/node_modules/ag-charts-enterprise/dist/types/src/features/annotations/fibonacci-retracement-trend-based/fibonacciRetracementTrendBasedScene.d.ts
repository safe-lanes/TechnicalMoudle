import { _ModuleSupport } from 'ag-charts-community';
import type { PointProperties } from '../annotationProperties';
import type { AnnotationContext } from '../annotationTypes';
import { FibonacciScene } from '../scenes/fibonacciScene';
import { DivariantHandle } from '../scenes/handle';
import type { StartEndHandle } from '../scenes/startEndScene';
import type { FibonacciRetracementTrendBasedProperties } from './fibonacciRetracementTrendBasedProperties';
type ActiveHandle = StartEndHandle | 'endRetracement';
export declare class FibonacciRetracementTrendBasedScene extends FibonacciScene<FibonacciRetracementTrendBasedProperties> {
    static is(value: unknown): value is FibonacciRetracementTrendBasedScene;
    type: string;
    activeHandle?: ActiveHandle;
    private readonly endRetracementLine;
    protected readonly start: DivariantHandle;
    protected readonly end: DivariantHandle;
    protected readonly endRetracement: DivariantHandle;
    protected readonly ignoreYBounds?: boolean;
    protected dragState?: {
        offset: _ModuleSupport.Vec2;
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
        endRetracement: _ModuleSupport.Vec2;
    };
    constructor();
    update(datum: FibonacciRetracementTrendBasedProperties, context: AnnotationContext): void;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    dragStart(datum: FibonacciRetracementTrendBasedProperties, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    stopDragging(): void;
    protected dragAll(datum: FibonacciRetracementTrendBasedProperties, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    dragHandle(datum: FibonacciRetracementTrendBasedProperties, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    snapToAngle(datum: FibonacciRetracementTrendBasedProperties, coords: _ModuleSupport.Vec2, context: AnnotationContext): Pick<PointProperties, 'x' | 'y'> | undefined;
    translatePoints({ datum, start, end, endRetracement, translation, context, }: {
        datum: FibonacciRetracementTrendBasedProperties;
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
        endRetracement: _ModuleSupport.Vec2;
        translation: _ModuleSupport.Vec2;
        context: AnnotationContext;
    }): void;
    translate(datum: FibonacciRetracementTrendBasedProperties, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    copy(datum: FibonacciRetracementTrendBasedProperties, copiedDatum: FibonacciRetracementTrendBasedProperties, context: AnnotationContext): FibonacciRetracementTrendBasedProperties | undefined;
    private getCoords;
    toggleHandles(show: boolean | Partial<Record<ActiveHandle, boolean>>): void;
    toggleActive(active: boolean): void;
    protected updateHandles(datum: FibonacciRetracementTrendBasedProperties, coords1: _ModuleSupport.Vec4, coords2?: _ModuleSupport.Vec4, bbox?: _ModuleSupport.BBox): void;
    protected getHandleCoords(_datum: FibonacciRetracementTrendBasedProperties, coords: _ModuleSupport.Vec4, handle: ActiveHandle, _bbox?: _ModuleSupport.BBox): _ModuleSupport.Vec2;
}
export {};
