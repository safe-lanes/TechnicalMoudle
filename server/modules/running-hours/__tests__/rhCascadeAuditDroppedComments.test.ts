import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { runningHoursAudit } from '@shared/schema';
import { describe, expect, it } from 'vitest';

// Verbatim pre-edit insert statements and logger calls, not replacement logic.
const originalSource = `
          const inheritedAuditResult = await tx.insert(runningHoursAudit).values({
            vesselId: inherited.vesselId || 'unknown',
            componentId: inherited.cuuid,
            previousRH: inheritedCurrentRH.toString(),
            newRH: newInheritedRH.toString(),
            cumulativeRH: newInheritedRH.toString(),
            dateUpdatedLocal: dateUpdated,
            dateUpdatedTZ: 'UTC',
            enteredAtUTC: now,
            userId: userId || 'system',
            actorLabel: getAuditActor().actorLabel, // Audit Phase 0: frozen human actor at write time
            updatedByUuid: userUuid || null,
            source: 'inherited_cascade',
            comments: \`Inherited delta \${inheritedDelta} from MASTER \${parentResult[0]?.componentCode || parentResult[0]?.name}\`,
          }).returning();
          try { await logFieldChanges('running_hours_audit', inheritedAuditResult[0].rhauuid, inherited.vesselId || null, null, inheritedAuditResult[0], userId || 'system'); } catch (e) { console.error('[FieldLogger] rha cascade inherited:', e); }
        const childAuditResult = await tx.insert(runningHoursAudit).values({
          vesselId: child.vesselId || 'unknown',
          componentId: child.cuuid,
          previousRH: childCurrentRH.toString(),
          newRH: childNewRH.toString(),
          cumulativeRH: childNewRH.toString(),
          dateUpdatedLocal: dateUpdated,
          dateUpdatedTZ: 'UTC',
          enteredAtUTC: now,
          userId: userId || 'system',
          actorLabel: getAuditActor().actorLabel, // Audit Phase 0: frozen human actor at write time
          updatedByUuid: userUuid || null,
          source: 'cascade',
          comments: comments,
        }).returning();
        try { await logFieldChanges('running_hours_audit', childAuditResult[0].rhauuid, child.vesselId || null, null, childAuditResult[0], userId || 'system'); } catch (e) { console.error('[FieldLogger] rha cascade child:', e); }
`;

const changedSource = readFileSync('server/postgresStorage.ts', 'utf8');

function extract(source: string, resultName: string) {
  const ast = ts.createSourceFile('audit-source.ts', source, ts.ScriptTarget.Latest, true);
  const declarations: ts.VariableDeclaration[] = [];
  const loggers: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === resultName) {
      declarations.push(node);
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'logFieldChanges'
      && node.arguments[4]?.getText(ast) === `${resultName}[0]`) {
      loggers.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (declarations.length !== 1 || loggers.length !== 1) {
    throw new Error(`Expected one real insert and logger for ${resultName}`);
  }
  const literals: ts.ObjectLiteralExpression[] = [];
  function findLiteral(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'values') {
      const argument = node.arguments[0];
      if (argument && ts.isObjectLiteralExpression(argument)) literals.push(argument);
    }
    ts.forEachChild(node, findLiteral);
  }
  findLiteral(declarations[0]);
  if (literals.length !== 1) throw new Error('Expected one real values object');
  return {
    literal: literals[0].getText(ast),
    keys: literals[0].properties.map(property => property.name?.getText(ast)),
    logger: loggers[0].getText(ast),
    loggerArguments: loggers[0].arguments.map(argument => argument.getText(ast)),
  };
}

function evaluate(literal: string, fallback: boolean): typeof runningHoursAudit.$inferInsert {
  const globals = {
    inherited: { vesselId: fallback ? null : 'fixture-vessel', cuuid: 'fixture-inherited' },
    child: { vesselId: fallback ? null : 'fixture-vessel', cuuid: 'fixture-structural' },
    inheritedCurrentRH: 100,
    newInheritedRH: 125,
    inheritedDelta: 25,
    parentResult: [{ componentCode: '100.01', name: 'Fixture master' }],
    childCurrentRH: 200,
    childNewRH: 225,
    dateUpdated: '2026-11-03',
    now: new Date('2026-11-03T00:00:00.000Z'),
    userId: fallback ? undefined : 'fixture-user',
    userUuid: fallback ? undefined : 'fixture-user-uuid',
    comments: fallback ? undefined : 'Unpersisted fixture cascade description',
    getAuditActor: () => ({ actorLabel: fallback ? null : 'Fixture actor' }),
    require(name: string) { throw new Error(`RH audit parity blocked import: ${name}`); },
  };
  return runInNewContext(`(${literal})`, globals, {
    timeout: 1000,
    contextCodeGeneration: { strings: false, wasm: false },
  });
}

describe('real cascade audit literals: SQL parity and source-level logger contract', () => {
  for (const name of ['inheritedAuditResult', 'childAuditResult']) {
    const before = extract(originalSource, name);
    const after = extract(changedSource, name);

    it(`${name}: only the dropped comments property is replaced`, () => {
      expect(before.keys).toContain('comments');
      expect(after.keys).toEqual(before.keys.filter(key => key !== 'comments'));
      expect(after.literal).toBe(before.literal.replace(
        /^([ \t]*)comments:.*$/m,
        '$1// Cascade description intentionally not persisted; mapping to notes requires a separate approved change.',
      ));
    });

    for (const fallback of [false, true]) {
      it(`${name}: byte-identical real INSERT SQL/parameters, fallbacks ${fallback}`, () => {
        let executions = 0;
        const database = drizzle(async () => {
          executions++;
          throw new Error('RH audit parity forbids query execution');
        });
        const beforeValues = evaluate(before.literal, fallback);
        const afterValues = evaluate(after.literal, fallback);
        expect(Object.hasOwn(beforeValues, 'comments')).toBe(true);
        expect(Object.hasOwn(afterValues, 'comments')).toBe(false);
        const original = database.insert(runningHoursAudit).values(beforeValues).returning().toSQL();
        const changed = database.insert(runningHoursAudit).values(afterValues).returning().toSQL();
        expect(changed.sql).toBe(original.sql);
        expect(changed.params).toEqual(original.params);
        expect(changed.params).toEqual([
          fallback ? 'unknown' : 'fixture-vessel',
          name === 'inheritedAuditResult' ? 'fixture-inherited' : 'fixture-structural',
          name === 'inheritedAuditResult' ? '100' : '200',
          name === 'inheritedAuditResult' ? '125' : '225',
          name === 'inheritedAuditResult' ? '125' : '225',
          '2026-11-03', 'UTC', '2026-11-03T00:00:00.000Z',
          fallback ? 'system' : 'fixture-user',
          fallback ? null : 'Fixture actor',
          name === 'inheritedAuditResult' ? 'inherited_cascade' : 'cascade',
          fallback ? null : 'fixture-user-uuid',
        ]);
        expect(changed.sql).not.toContain('"comments"');
        expect(changed.params).not.toContain('Unpersisted fixture cascade description');
        expect(executions).toBe(0);
      });
    }

    it(`${name}: unchanged complete logger call passes the returned database row`, () => {
      expect(after.logger).toBe(before.logger);
      expect(after.loggerArguments).toEqual(before.loggerArguments);
      expect(after.loggerArguments[0]).toBe("'running_hours_audit'");
      expect(after.loggerArguments[1]).toBe(`${name}[0].rhauuid`);
      expect(after.loggerArguments[3]).toBe('null');
      expect(after.loggerArguments[4]).toBe(`${name}[0]`);
    });
  }

  it('literal sandbox exposes no process, network or timers and denies imports', () => {
    expect(() => evaluate("require('../db')", false)).toThrow('RH audit parity blocked import');
    expect(() => evaluate('process.env', false)).toThrow('process is not defined');
    for (const identifier of ['fetch', 'WebSocket', 'XMLHttpRequest', 'setTimeout', 'setInterval']) {
      expect(() => evaluate(`${identifier}()`, false)).toThrow(`${identifier} is not defined`);
    }
  });
});
