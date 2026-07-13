import type { BeanCollection } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
import type { ChartMenuContext } from '../../chartMenuContext';
import type { FormatPanelOptions } from '../formatPanel';
export declare class LegendPanel extends Component {
    private readonly options;
    private readonly chartMenuContext;
    private chartTranslation;
    private readonly chartController;
    wireBeans(beans: BeanCollection): void;
    private readonly legendGroup;
    private enabledGroup;
    private readonly key;
    private readonly isGradient;
    constructor(options: FormatPanelOptions, chartMenuContext: ChartMenuContext);
    postConstruct(): void;
    private updateLegendEnabledState;
    private getItems;
    private createLabelPanel;
}
