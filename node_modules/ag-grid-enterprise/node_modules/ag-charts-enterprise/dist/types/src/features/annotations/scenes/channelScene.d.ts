import { _ModuleSupport } from 'ag-charts-community';
import type { ChannelTextProperties } from '../annotationProperties';
import type { AnnotationContext, Point } from '../annotationTypes';
import { CollidableLine } from './collidableLineScene';
import type { CollidableText } from './collidableTextScene';
import type { Handle } from './handle';
import { LinearScene } from './linearScene';
type ChannelHandle = Partial<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'topMiddle' | 'bottomMiddle'>;
export declare abstract class ChannelScene<Datum extends {
    background: {
        fill?: string;
        fillOpacity?: number;
    };
    locked?: boolean;
    visible?: boolean;
    start: Point;
    end: Point;
    bottom: {
        start: Point;
        end: Point;
    };
    strokeWidth?: number;
    text?: ChannelTextProperties;
}> extends LinearScene<Datum> {
    protected handles: {
        [key: string]: Handle;
    };
    protected overflowContinuous: number;
    protected topLine: CollidableLine;
    protected bottomLine: CollidableLine;
    background: _ModuleSupport.Path<any>;
    text?: CollidableText;
    private readonly anchor;
    update(datum: Datum, context: AnnotationContext): void;
    toggleHandles(show: boolean | Partial<Record<ChannelHandle, boolean>>): void;
    toggleActive(active: boolean): void;
    stopDragging(): void;
    getAnchor(): _ModuleSupport.FloatingToolbarAnchor;
    getCursor(): string | undefined;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    protected abstract updateLines(datum: Datum, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, context: AnnotationContext, naturalTop: _ModuleSupport.Vec4, naturalBottom: _ModuleSupport.Vec4): void;
    protected abstract updateHandles(datum: Datum, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    protected abstract updateText(datum: Datum, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    protected readonly updateBackground: (datum: {
        background: import("ag-charts-community").FillOptions;
    }, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, context: AnnotationContext) => void;
    protected updateAnchor(top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4): void;
    abstract getBackgroundPoints(datum: Datum, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, bounds: _ModuleSupport.Vec4): Array<_ModuleSupport.Vec2>;
}
export {};
