import type { NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class ExpandListener extends BeanStub implements NamedBean {
    beanName: "ssrmExpandListener";
    postConstruct(): void;
    private onRowExpandStateChanged;
}
