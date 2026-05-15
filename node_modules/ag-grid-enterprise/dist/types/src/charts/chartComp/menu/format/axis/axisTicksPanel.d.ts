import type { BeanCollection } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
import type { ChartMenuParamsFactory } from '../../chartMenuParamsFactory';
export declare class AxisTicksPanel extends Component {
    private readonly chartMenuUtils;
    private chartTranslation;
    private readonly axisTicksSizeSlider;
    wireBeans(beans: BeanCollection): void;
    constructor(chartMenuUtils: ChartMenuParamsFactory);
    postConstruct(): void;
    setTickSizeSliderDisplayed(displayed: boolean): void;
}
