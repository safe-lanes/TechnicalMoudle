import type { AgCartesianAxisType, AgChartInstance, AgChartInstanceOptions, AgPolarAxisOptions } from 'ag-charts-types';
export declare function deproxy(chartOrProxy: AgChartInstance<AgChartInstanceOptions>): AgChartActual;
export interface AgChartActual extends AgChartInstance {
    title: {
        node: {
            getPlainText: () => string;
        };
    };
    width: number;
    height: number;
    series: {
        id: string;
        type: string;
        toggleSeriesItem(enabled?: boolean, legendType?: string, itemId?: string, legendItemName?: string): void;
        properties: {
            [key: string]: any;
            toJson(): any;
        };
    }[];
    axes?: {
        type: AgCartesianAxisType | AgPolarAxisOptions['type'];
        direction: 'x' | 'y';
    }[];
    canvasElement: HTMLCanvasElement;
    getCanvasDataURL(type?: string): string;
    addEventListener(type: 'click', cb: (even: any) => void): void;
    waitForUpdate(): Promise<void>;
}
type AgChartAxis = NonNullable<AgChartActual['axes']>[number];
export type AgChartAxisType = AgChartAxis['type'];
export {};
