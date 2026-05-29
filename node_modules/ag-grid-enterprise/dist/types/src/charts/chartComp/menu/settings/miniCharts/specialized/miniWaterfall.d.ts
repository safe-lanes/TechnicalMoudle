import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export declare class MiniWaterfallClass extends MiniChartWithAxes {
    private readonly bars;
    private data;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], isCustomTheme: boolean);
    updateColors(fills: string[], strokes: string[], isCustomTheme?: boolean): void;
    createWaterfall(root: any, data: number[], size: number, padding: number, direction: 'horizontal' | 'vertical'): {
        bars: any[];
    };
}
export declare const MiniWaterfall: MiniChartSelector;
