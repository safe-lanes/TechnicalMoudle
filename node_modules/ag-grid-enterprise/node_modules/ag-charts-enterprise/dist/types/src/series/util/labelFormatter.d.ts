import type { AgChartAutoSizedBaseLabelOptions, AgChartAutoSizedLabelOptions, AgChartAutoSizedSecondaryLabelOptions, FontSize } from 'ag-charts-types';
interface AutoSizedBaseLabelOptions extends AgChartAutoSizedBaseLabelOptions<unknown, any> {
    fontSize: FontSize;
}
interface AutoSizedLabelOptions extends AgChartAutoSizedLabelOptions<unknown, any> {
    fontSize: FontSize;
}
interface AutoSizedSecondaryLabelOptions extends AgChartAutoSizedSecondaryLabelOptions<unknown, any> {
    fontSize: FontSize;
}
type FontSizeCandidate = {
    labelFontSize: number;
    secondaryLabelFontSize: number;
};
export declare function generateLabelSecondaryLabelFontSizeCandidates(label: AutoSizedBaseLabelOptions, secondaryLabel: AutoSizedBaseLabelOptions): FontSizeCandidate[];
type LayoutParams = {
    padding: number;
};
export type LabelFormatting = {
    text: string;
    fontSize: number;
    lineHeight: number;
    width: number;
    height: number;
};
type StackedLabelFormatting<Meta> = {
    width: number;
    height: number;
    meta: Meta;
} & ({
    label: LabelFormatting;
    secondaryLabel: LabelFormatting;
} | {
    label: LabelFormatting;
    secondaryLabel: LabelFormatting | undefined;
} | {
    label: LabelFormatting | undefined;
    secondaryLabel: LabelFormatting;
});
type SizeFittingHeightFn<Meta> = (height: number, canTruncate: boolean) => {
    width: number;
    height: number;
    meta: Meta;
};
export declare function getLineHeight(labelProps: AgChartAutoSizedLabelOptions<any, any>, fontSize: number): number;
export declare function formatStackedLabels<Meta>(labelValue: string, labelProps: AutoSizedLabelOptions, secondaryLabelValue: string, secondaryLabelProps: AutoSizedSecondaryLabelOptions, { padding }: LayoutParams, sizeFittingHeight: SizeFittingHeightFn<Meta>): ({
    width: number;
    height: number;
    meta: Meta;
} & {
    label: LabelFormatting;
    secondaryLabel: LabelFormatting | undefined;
}) | ({
    width: number;
    height: number;
    meta: Meta;
} & {
    label: LabelFormatting | undefined;
    secondaryLabel: LabelFormatting;
}) | undefined;
export declare function formatSingleLabel<Meta>(value: string, props: AutoSizedBaseLabelOptions, { padding }: LayoutParams, sizeFittingHeight: SizeFittingHeightFn<Meta>): [LabelFormatting, Meta] | undefined;
export declare function formatLabels<Meta = never>(baseLabelValue: string | undefined, labelProps: AutoSizedLabelOptions, baseSecondaryLabelValue: string | undefined, secondaryLabelProps: AutoSizedSecondaryLabelOptions, layoutParams: LayoutParams, sizeFittingHeight: SizeFittingHeightFn<Meta>): StackedLabelFormatting<Meta> | undefined;
export {};
