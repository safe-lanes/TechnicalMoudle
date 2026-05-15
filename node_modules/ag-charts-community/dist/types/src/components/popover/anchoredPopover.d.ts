import type { Vec2 } from '../../util/vector';
import type { ExpandableWidget, ExpansionControllerWidget } from '../../widget/expandableWidget';
import { Popover, type PopoverOptions } from './popover';
export interface AnchoredPopoverOptions extends PopoverOptions {
    anchor?: Vec2;
    fallbackAnchor?: Vec2;
}
/**
 * A popover that opens at a given anchor point, keeps itself within the bounds of the chart, and can not be directly
 * moved by the user.
 */
export declare abstract class AnchoredPopover<Options extends AnchoredPopoverOptions = AnchoredPopoverOptions> extends Popover<Options> {
    private anchor?;
    private fallbackAnchor?;
    setAnchor(anchor: Vec2, fallbackAnchor?: Partial<Vec2>): void;
    private updateAnchor;
    protected showWidget(controller: ExpansionControllerWidget, owns: ExpandableWidget, options: Options): void;
    protected showWithChildren(children: Array<HTMLElement>, options: Options): HTMLElement;
    protected repositionWithinBounds(): void;
}
