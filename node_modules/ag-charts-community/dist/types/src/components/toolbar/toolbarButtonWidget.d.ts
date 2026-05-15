import type { AgAnnotationOptionsToolbarButtonValue, AgAnnotationOptionsToolbarSwitchValue, AgAnnotationsToolbarButtonValue, AgIconName, AgRangesButtonValue, AgZoomButtonValue } from 'ag-charts-types';
import type { LocaleManager } from '../../locale/localeManager';
import { ButtonWidget } from '../../widget/buttonWidget';
type ButtonValue = 'menu' | AgAnnotationsToolbarButtonValue | AgAnnotationOptionsToolbarButtonValue | AgAnnotationOptionsToolbarSwitchValue | AgZoomButtonValue | AgRangesButtonValue;
export interface ToolbarButtonWidgetOptions {
    icon?: AgIconName;
    label?: string;
    ariaLabel?: string;
    tooltip?: string;
    value: ButtonValue;
}
export declare class ToolbarButtonWidget extends ButtonWidget {
    private readonly localeManager;
    section?: string;
    constructor(localeManager: LocaleManager);
    update(options: ToolbarButtonWidgetOptions): void;
    setChecked(checked: boolean): void;
}
export {};
