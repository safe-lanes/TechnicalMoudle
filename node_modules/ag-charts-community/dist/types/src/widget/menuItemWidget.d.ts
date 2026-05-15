import { AbstractButtonWidget } from './abstractButtonWidget';
export declare class MenuItemWidget extends AbstractButtonWidget<HTMLDivElement> {
    constructor();
}
export declare class MenuItemRadioWidget extends AbstractButtonWidget<HTMLDivElement> {
    constructor();
    setChecked(checked: boolean): void;
}
