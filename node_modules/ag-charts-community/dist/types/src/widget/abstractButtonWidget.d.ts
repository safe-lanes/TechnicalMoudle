import type { ExpandOpts, ExpandableWidget, ExpansionControllerWidget } from './expandableWidget';
import { Widget } from './widget';
import type { WidgetEventMap as EventMap } from './widgetEvents';
type R = ReturnType<Widget['addListener']>;
export declare class AbstractButtonWidget<TElement extends HTMLElement> extends Widget<TElement> implements ExpansionControllerWidget<TElement> {
    private controllerImpl?;
    private lazyControllerImpl;
    constructor(element: TElement, role?: 'menuitem' | 'menuitemradio');
    protected destructor(): void;
    setEnabled(enabled: boolean): void;
    setControlled(controls: ExpandableWidget<TElement> | undefined): void;
    getControlled(): ExpandableWidget<TElement> | undefined;
    expandControlled(opts?: ExpandOpts): void;
    addListener<K extends keyof EventMap>(type: K, listener: (ev: EventMap[K], current: this) => unknown): R;
}
export {};
