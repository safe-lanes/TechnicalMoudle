import { _ModuleSupport } from 'ag-charts-community';
import { AnnotationShape } from './annotationShape';
type UnivariantHandleStyles = {
    x: number;
    y: number;
} & {
    [K in keyof _ModuleSupport.Rect]?: _ModuleSupport.Rect[K];
};
type DivariantHandleStyles = {
    x: number;
    y: number;
} & {
    [K in keyof AnnotationShape]?: AnnotationShape[K];
};
export declare abstract class Handle extends _ModuleSupport.Group {
    static readonly HANDLE_SIZE: number;
    static readonly GLOW_SIZE: number;
    static readonly INACTIVE_STROKE_WIDTH = 2;
    abstract handle: _ModuleSupport.Rect | AnnotationShape;
    protected abstract glow: _ModuleSupport.Rect | AnnotationShape;
    protected active: boolean;
    protected locked: boolean;
    visible: boolean;
    zIndex: number;
    abstract update(styles: {
        [K in keyof (_ModuleSupport.Rect | AnnotationShape)]?: (_ModuleSupport.Rect | AnnotationShape)[K];
    }): void;
    drag(target: _ModuleSupport.Vec2): {
        point: _ModuleSupport.Vec2;
        offset: _ModuleSupport.Vec2;
    };
    toggleActive(active: boolean): void;
    toggleHovered(hovered: boolean): void;
    toggleDragging(dragging: boolean): void;
    toggleLocked(locked: boolean): void;
    getCursor(): string | undefined;
    containsPoint(x: number, y: number): boolean;
}
export declare class UnivariantHandle extends Handle {
    static readonly HANDLE_SIZE = 12;
    static readonly GLOW_SIZE = 16;
    static readonly CORNER_RADIUS = 4;
    handle: _ModuleSupport.Rect<any>;
    glow: _ModuleSupport.Rect<any>;
    gradient: 'horizontal' | 'vertical';
    private cachedStyles?;
    constructor();
    toggleLocked(locked: boolean): void;
    update(styles: UnivariantHandleStyles): void;
    drag(target: _ModuleSupport.Vec2): {
        point: _ModuleSupport.Vec2;
        offset: {
            x: number;
            y: number;
        };
    };
    getCursor(): "col-resize" | "row-resize" | undefined;
}
export declare class DivariantHandle extends Handle {
    static readonly HANDLE_SIZE = 11;
    static readonly GLOW_SIZE = 17;
    handle: AnnotationShape;
    glow: AnnotationShape;
    private cachedStyles?;
    constructor();
    toggleLocked(locked: boolean): void;
    update(styles: DivariantHandleStyles): void;
    getCursor(): string;
}
export {};
