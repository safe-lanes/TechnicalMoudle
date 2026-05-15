import type { ExpandControlledOpts, ExpandControlledWidgetEvent, ExpandableWidget, ExpansionControllerWidget } from './expandableWidget';
import type { Widget } from './widget';
interface Dispatcher {
    dispatch(type: 'expand-controlled-widget', current: Widget, event: ExpandControlledWidgetEvent): void;
}
export declare class ExpansionControllerImpl<TElement extends HTMLElement> implements ExpansionControllerWidget<TElement> {
    private readonly getDispatcher;
    private readonly controller;
    private controls?;
    private readonly onExpanded;
    private readonly onCollapsed;
    constructor(controller: Widget & ExpansionControllerWidget<TElement>, getDispatcher: () => Dispatcher | undefined);
    destroy(): void;
    setControlled(controls: ExpandableWidget<TElement> | undefined): void;
    getControlled(): ExpandableWidget<TElement> | undefined;
    expandControlled(opts?: ExpandControlledOpts): void;
}
export {};
