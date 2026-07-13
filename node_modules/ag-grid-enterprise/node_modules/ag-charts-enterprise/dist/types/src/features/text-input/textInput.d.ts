import { _ModuleSupport } from 'ag-charts-community';
import type { FontOptions, TextAlign } from 'ag-charts-types';
import type { AnnotationTextPosition } from '../annotations/text/util';
interface Layout {
    getTextInputCoords: (height: number) => _ModuleSupport.Vec2;
    getTextPosition: () => AnnotationTextPosition;
    alignment: 'left' | 'center' | 'right';
    textAlign: TextAlign;
    width?: number;
}
export declare class TextInput extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    readonly ctx: _ModuleSupport.ModuleContext;
    private readonly element;
    private layout;
    private visible;
    constructor(ctx: _ModuleSupport.ModuleContext);
    setKeyDownHandler(handler: (e: KeyboardEvent) => unknown): void;
    show(opts: {
        anchor?: {
            x: number;
            y: number;
        };
        text?: string;
        placeholderText?: string;
        styles?: FontOptions & {
            placeholderColor?: string;
        };
        layout?: Layout;
        onChange?: (text: string, bbox: _ModuleSupport.BBox) => void;
        onClose?: (text: string) => void;
    }): void;
    hide(): void;
    isVisible(): boolean;
    updateColor(color: string): void;
    updateFontSize(fontSize: number): _ModuleSupport.BBox | undefined;
    getValue(): string | undefined;
    private updatePosition;
    getBBox(): _ModuleSupport.BBox;
}
export {};
