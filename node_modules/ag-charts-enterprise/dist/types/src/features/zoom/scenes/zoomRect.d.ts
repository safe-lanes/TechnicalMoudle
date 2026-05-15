import { _ModuleSupport } from 'ag-charts-community';
export declare class ZoomRect extends _ModuleSupport.Rect {
    static readonly className = "ZoomRect";
    fill: string;
    fillOpacity: number;
    zIndex: _ModuleSupport.ZIndexMap;
    updateValid(): void;
    updateInvalid(): void;
}
