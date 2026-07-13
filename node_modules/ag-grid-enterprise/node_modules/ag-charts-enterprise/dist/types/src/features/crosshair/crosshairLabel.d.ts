import type { AgCrosshairLabelFormatterParams, AgCrosshairLabelRendererParams, AgCrosshairLabelRendererResult, ContextDefault, Formatter, FormatterParams } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
type StyleValue = string | number | undefined;
export declare class CrosshairLabelProperties extends BaseProperties implements _ModuleSupport.AxisFormattableLabel<AgCrosshairLabelFormatterParams<ContextDefault>, FormatterParams> {
    enabled: boolean;
    xOffset: number;
    yOffset: number;
    formatter?: Formatter<AgCrosshairLabelFormatterParams<ContextDefault>>;
    format?: string;
    renderer?: (params: AgCrosshairLabelRendererParams) => string | AgCrosshairLabelRendererResult;
    private _cachedFormatter;
    formatValue(callWithContext: (formatter: (params: AgCrosshairLabelFormatterParams<ContextDefault>) => string | undefined, params: AgCrosshairLabelFormatterParams<ContextDefault>) => string | undefined, type: 'number' | 'date' | 'category', value: any, params: FormatterParams<any>): string | undefined;
}
export declare class CrosshairLabel extends CrosshairLabelProperties {
    private readonly domManager;
    private readonly id;
    private readonly element;
    constructor(domManager: _ModuleSupport.DOMManager, key: string, axisId: string);
    show(meta: _ModuleSupport.Point): void;
    setLabelHtml({ html, styles }: {
        html?: string;
        styles?: Record<string, StyleValue>;
    }): void;
    getBBox(): _ModuleSupport.BBox;
    toggle(visible?: boolean): void;
    destroy(): void;
    toLabelHtml(input: string | AgCrosshairLabelRendererResult, defaults?: AgCrosshairLabelRendererResult): {
        html: string;
        styles: Record<string, StyleValue>;
    };
}
export {};
