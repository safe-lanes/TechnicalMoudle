import fs from 'node:fs';
import { transformSync } from 'esbuild';

// Execute actual unchanged frontend closures, not rewritten filter/export logic.
export const surveyFrontend = fs.readFileSync('client/src/pages/cert-surveys/SurveysPage.tsx', 'utf8');
const parser = surveyFrontend.slice(surveyFrontend.indexOf('const parseDisplayDate ='),
  surveyFrontend.indexOf('interface SurveyData'));

export function surveyClientFunction(name: 'filter' | 'export', state: Record<string, unknown>) {
  const prefix = name === 'filter'
    ? 'const filteredSurveys = useMemo(() => {' : 'const fetchAllSurveys = useCallback(async () => {';
  const suffix = name === 'filter'
    ? '}, [surveys, selectedVesselNames, dueInFilter]);' : '}, [selectedVesselNames, dueInFilter]);';
  const start = surveyFrontend.indexOf(prefix) + prefix.length;
  const end = surveyFrontend.indexOf(suffix, start);
  if (start < prefix.length || end < 0) throw new Error('Survey frontend closure moved');
  const code = transformSync(`${parser}\nexports.run = ${name === 'export' ? 'async ' : ''}function() {
    ${surveyFrontend.slice(start, end)}
  };`, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const exports: any = {};
  new Function('exports', ...Object.keys(state), code)(exports, ...Object.values(state));
  return exports.run;
}

export function surveyClientDeclaration(name: string, next: string, state: Record<string, unknown>) {
  const start = surveyFrontend.indexOf(`const ${name}`);
  const end = surveyFrontend.indexOf(next, start);
  if (start < 0 || end < 0) throw new Error(`Survey frontend declaration moved: ${name}`);
  const code = transformSync(`${surveyFrontend.slice(start, end)}\nexports.run = ${name};`,
    { loader: 'tsx', format: 'cjs', target: 'es2022' }).code;
  const exports: any = {};
  new Function('exports', 'useCallback', 'useMutation', 'useMemo', ...Object.keys(state), code)(
    exports, (fn: unknown) => fn, (config: unknown) => config, (fn: () => unknown) => fn(),
    ...Object.values(state));
  return exports.run;
}
