import type { ModuleInstance } from '../../module/baseModule';
import { BaseModuleInstance } from '../../module/module';
import type { ModuleContext } from '../../module/moduleContext';
import type { Vec2 } from '../../util/vector';
import type { ExpandableWidget, ExpansionControllerWidget } from '../../widget/expandableWidget';
export interface PopoverConstructorOptions {
    detached?: boolean;
}
export interface PopoverOptions {
    ariaLabel?: string;
    class?: string;
    initialFocus?: HTMLElement;
    sourceEvent?: Event;
    onHide?: () => void;
}
/**
 * A non-modal element that overlays the chart.
 */
export declare abstract class Popover<Options extends PopoverOptions = PopoverOptions> extends BaseModuleInstance implements ModuleInstance {
    protected readonly ctx: ModuleContext;
    protected readonly hideFns: Array<() => void>;
    private readonly moduleId;
    private readonly element;
    private lastFocus?;
    private initialFocus?;
    constructor(ctx: ModuleContext, id: string, options?: PopoverConstructorOptions);
    private readonly setOwnedWidget;
    attachTo(popover: Popover): void;
    hide(opts?: {
        lastFocus?: null;
    }): void;
    protected removeChildren(): void;
    private initPopoverElement;
    protected showWidget(controller: ExpansionControllerWidget, owns: ExpandableWidget, options: Options): void;
    protected showWithChildren(children: Array<HTMLElement>, options: Options): HTMLElement;
    protected getPopoverElement(): HTMLDivElement | undefined;
    protected updatePosition(position: Partial<Vec2>): void;
}
