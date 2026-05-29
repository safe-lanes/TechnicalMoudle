import { _ModuleSupport } from 'ag-charts-community';
import { Image } from '../image/image';
export declare class Background extends _ModuleSupport.Background<Image> {
    image: Image;
    protected onLayoutComplete(event: _ModuleSupport.LayoutCompleteEvent): void;
    protected onImageLoad(): void;
}
