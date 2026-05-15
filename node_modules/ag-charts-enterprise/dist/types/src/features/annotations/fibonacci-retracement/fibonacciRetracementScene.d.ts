import { _ModuleSupport } from 'ag-charts-community';
import type { PointProperties } from '../annotationProperties';
import type { AnnotationContext } from '../annotationTypes';
import { FibonacciScene } from '../scenes/fibonacciScene';
import { DivariantHandle } from '../scenes/handle';
import type { StartEndHandle } from '../scenes/startEndScene';
import type { FibonacciRetracementProperties } from './fibonacciRetracementProperties';
export declare class FibonacciRetracementScene extends FibonacciScene<FibonacciRetracementProperties> {
    static is(value: unknown): value is FibonacciRetracementScene;
    type: string;
    activeHandle?: StartEndHandle;
    protected readonly start: DivariantHandle;
    protected readonly end: DivariantHandle;
    protected readonly ignoreYBounds?: boolean;
    protected dragState?: {
        offset: _ModuleSupport.Vec2;
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
    };
    constructor();
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    dragStart(datum: FibonacciRetracementProperties, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    stopDragging(): void;
    protected dragAll(datum: FibonacciRetracementProperties, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    dragHandle(datum: FibonacciRetracementProperties, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    snapToAngle(datum: FibonacciRetracementProperties, coords: _ModuleSupport.Vec2, context: AnnotationContext): Pick<PointProperties, 'x' | 'y'> | undefined;
    translatePoints({ datum, start, end, translation, context, }: {
        datum: FibonacciRetracementProperties;
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
        translation: _ModuleSupport.Vec2;
        context: AnnotationContext;
    }): void;
    translate(datum: FibonacciRetracementProperties, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    copy(datum: FibonacciRetracementProperties, copiedDatum: FibonacciRetracementProperties, context: AnnotationContext): FibonacciRetracementProperties | undefined;
    toggleHandles(show: boolean | Partial<Record<StartEndHandle, boolean>>): void;
    toggleActive(active: boolean): void;
    protected updateHandles(datum: FibonacciRetracementProperties, coords: _ModuleSupport.Vec4, _coords2: _ModuleSupport.Vec4, bbox?: _ModuleSupport.BBox): void;
    protected getHandleCoords(_datum: FibonacciRetracementProperties, coords: _ModuleSupport.Vec4, handle: StartEndHandle, _bbox?: _ModuleSupport.BBox): _ModuleSupport.Vec2;
}
