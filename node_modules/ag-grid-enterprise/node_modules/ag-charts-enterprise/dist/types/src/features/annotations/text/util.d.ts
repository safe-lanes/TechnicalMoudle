import { type TextAlign, _ModuleSupport } from 'ag-charts-community';
export type AnnotationTextPosition = 'top' | 'center' | 'bottom';
export type AnnotationTextAlignment = 'left' | 'center' | 'right';
type TextOptions = _ModuleSupport.FontOptions & {
    textAlign: TextAlign;
    position: AnnotationTextPosition;
};
export declare const ANNOTATION_TEXT_LINE_HEIGHT = 1.38;
export declare function wrapText(options: TextOptions, text: string, width: number): string;
export declare function getBBox(options: TextOptions & {
    width?: number;
}, text: string, coords: _ModuleSupport.Vec2, bbox?: _ModuleSupport.BBox): _ModuleSupport.BBox;
export declare function updateTextNode(node: _ModuleSupport.Text, text: string, isPlaceholder: boolean, config: TextOptions & {
    visible?: boolean;
    color?: string;
    getPlaceholderColor: () => string | undefined;
}, { x, y }: _ModuleSupport.Vec2, textBaseline?: CanvasTextBaseline): void;
export {};
