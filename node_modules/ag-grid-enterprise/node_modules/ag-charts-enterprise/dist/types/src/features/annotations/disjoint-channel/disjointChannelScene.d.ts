import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import { ChannelScene } from '../scenes/channelScene';
import { DivariantHandle, UnivariantHandle } from '../scenes/handle';
import type { DisjointChannelProperties } from './disjointChannelProperties';
type ChannelHandle = keyof DisjointChannelScene['handles'];
export declare class DisjointChannelScene extends ChannelScene<DisjointChannelProperties> {
    static is(value: unknown): value is DisjointChannelScene;
    type: string;
    activeHandle?: ChannelHandle;
    handles: {
        topLeft: DivariantHandle;
        topRight: DivariantHandle;
        bottomLeft: DivariantHandle;
        bottomRight: UnivariantHandle;
    };
    constructor();
    dragHandle(datum: DisjointChannelProperties, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    protected getTranslatePointsVectors(start: _ModuleSupport.Vec2, end: _ModuleSupport.Vec2): {
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
        bottomStart: _ModuleSupport.Vec2;
        bottomEnd: _ModuleSupport.Vec2;
    };
    updateLines(datum: DisjointChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    updateHandles(datum: DisjointChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    updateText(datum: DisjointChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    getBackgroundPoints(datum: DisjointChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, bounds: _ModuleSupport.Vec4): [_ModuleSupport.Vec2, _ModuleSupport.Vec2];
}
export {};
