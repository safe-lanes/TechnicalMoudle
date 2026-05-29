import { _ModuleSupport } from 'ag-charts-community';
import { Image } from '../image/image';
export declare class Foreground extends _ModuleSupport.Background<Image> {
    image: Image;
    fill?: string;
    fillOpacity?: number;
    protected createNode(): _ModuleSupport.Group<unknown>;
    protected onLayoutComplete(event: _ModuleSupport.LayoutCompleteEvent): void;
    protected onImageLoad(): void;
    private updateTextNode;
}
