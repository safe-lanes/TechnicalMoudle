import type { UpdateChartParams } from 'ag-grid-community';
import type { CommonCreateChartParams } from '../../chartService';
export declare function validateUpdateParams(params: UpdateChartParams, isEnterprise: boolean): boolean | UpdateChartParams;
export declare function validateCreateParams(params: CommonCreateChartParams, isEnterprise: boolean): boolean | CommonCreateChartParams;
