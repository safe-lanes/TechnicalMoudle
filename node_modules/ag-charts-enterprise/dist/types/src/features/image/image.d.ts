import { _ModuleSupport } from 'ag-charts-community';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
export declare class Image extends BaseProperties {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    width?: number;
    height?: number;
    opacity: number;
    url?: string;
    private readonly imageElement;
    private loadedSynchronously;
    readonly node: _ModuleSupport.Image;
    constructor();
    get complete(): boolean;
    private containerWidth;
    private containerHeight;
    onLoad?: () => void;
    performLayout(containerWidth: number, containerHeight: number): _ModuleSupport.Placement;
    private readonly onImageLoad;
}
export {};
