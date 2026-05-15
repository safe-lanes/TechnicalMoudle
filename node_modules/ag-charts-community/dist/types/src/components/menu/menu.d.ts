import type { LabelIcon } from '../../dom/elements';
import type { ExpansionControllerWidget } from '../../widget/expandableWidget';
import { AnchoredPopover, type AnchoredPopoverOptions } from '../popover/anchoredPopover';
export interface MenuOptions<Value = any> extends AnchoredPopoverOptions {
    items: Array<MenuItem<Value>>;
    value?: Value;
    onPress?: (item: MenuItem<Value>) => void;
    menuItemRole?: 'menuitem' | 'menuitemradio';
}
export type MenuItem<Value = any> = LabelIcon & {
    value: Value;
    strokeWidth?: number;
};
/**
 * An anchored popover containing a list of pressable items.
 */
export declare class Menu extends AnchoredPopover {
    show<Value = any>(controller: ExpansionControllerWidget, options: MenuOptions<Value>): void;
    private allocRow;
    private createRow;
}
