import { _ModuleSupport } from 'ag-charts-community';
export declare abstract class AnnotationScene extends _ModuleSupport.Group {
    static isCheck(value: unknown, type: string): boolean;
    name: string;
    zIndex: _ModuleSupport.ZIndexMap;
    abstract type: string;
    abstract activeHandle?: string;
    abstract containsPoint(x: number, y: number): boolean;
    abstract toggleHandles(show: boolean | Record<string, boolean>): void;
    abstract toggleActive(active: boolean): void;
    abstract stopDragging(): void;
    abstract getAnchor(): _ModuleSupport.FloatingToolbarAnchor;
    abstract getCursor(): string | undefined;
    abstract getNodeAtCoords(x: number, y: number): string | undefined;
    toggleHovered(hovered: boolean): void;
    protected computeBBoxWithoutHandles(): _ModuleSupport.BBox;
    protected updateNode<TNode extends _ModuleSupport.Node>(constructor: new () => TNode, node?: TNode, isConfigured?: boolean): TNode | undefined;
}
