import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import { ChannelScene } from '../scenes/channelScene';
import { DivariantHandle, UnivariantHandle } from '../scenes/handle';
import type { ParallelChannelProperties } from './parallelChannelProperties';
type ChannelHandle = keyof ParallelChannelScene['handles'];
export declare class ParallelChannelScene extends ChannelScene<ParallelChannelProperties> {
    static is(value: unknown): value is ParallelChannelScene;
    type: string;
    activeHandle?: ChannelHandle;
    handles: {
        topLeft: DivariantHandle;
        topMiddle: UnivariantHandle;
        topRight: DivariantHandle;
        bottomLeft: DivariantHandle;
        bottomMiddle: UnivariantHandle;
        bottomRight: DivariantHandle;
    };
    private readonly middleLine;
    constructor();
    dragHandle(datum: ParallelChannelProperties, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    protected getTranslatePointsVectors(start: _ModuleSupport.Vec2, end: _ModuleSupport.Vec2): {
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
        bottomStart: _ModuleSupport.Vec2;
        bottomEnd: _ModuleSupport.Vec2;
    };
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    updateLines(datum: ParallelChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, context: AnnotationContext, naturalTop: _ModuleSupport.Vec4, naturalBottom: _ModuleSupport.Vec4): void;
    updateHandles(datum: ParallelChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    updateText(datum: ParallelChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    getBackgroundPoints(datum: ParallelChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, bounds: _ModuleSupport.Vec4): [_ModuleSupport.Vec2, _ModuleSupport.Vec2];
}
export {};
