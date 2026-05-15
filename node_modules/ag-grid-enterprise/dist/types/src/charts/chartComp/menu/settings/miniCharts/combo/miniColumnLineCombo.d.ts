import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export declare class MiniColumnLineComboClass extends MiniChartWithAxes {
    private readonly columns;
    private readonly lines;
    private readonly columnData;
    private readonly lineData;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniColumnLineCombo: MiniChartSelector;
