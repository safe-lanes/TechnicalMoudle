/**
 * Card registry — global code, not tenant data (v3 §A7). Cards register at boot;
 * a broken card REFUSES the start with a precise error (fail-loud, never fail-open).
 */
import type { ApprovalCard, Scope } from './types';

export interface RegistryTree {
  modules: Array<{
    moduleId: string;
    label: string;
    scopes: Array<{ screenId: string; actionId: string; label: string; classifications: { id: string; label: string }[] }>;
  }>;
}

export class CardRegistrationError extends Error {
  constructor(message: string) { super(`[approval-engine] card registration refused: ${message}`); }
}

const REQUIRED_FNS = ['listRoles', 'classify', 'resolveApprovers', 'onDecision'] as const;

export class CardRegistry {
  private cards = new Map<string, ApprovalCard>();

  /** Validates and registers. Throws CardRegistrationError on the first violation. */
  register(card: ApprovalCard): void {
    if (!card || typeof card !== 'object') throw new CardRegistrationError('card is not an object');
    if (!card.moduleId || typeof card.moduleId !== 'string') throw new CardRegistrationError('card.moduleId missing');
    if (this.cards.has(card.moduleId)) throw new CardRegistrationError(`duplicate moduleId "${card.moduleId}"`);
    if (!card.label) throw new CardRegistrationError(`card "${card.moduleId}": label missing`);
    for (const fn of REQUIRED_FNS) {
      if (typeof (card as any)[fn] !== 'function') {
        throw new CardRegistrationError(`card "${card.moduleId}": required function ${fn}() missing`);
      }
    }
    if (card.onPending !== undefined && typeof card.onPending !== 'function') {
      throw new CardRegistrationError(`card "${card.moduleId}": onPending must be a function when present`);
    }
    if (!Array.isArray(card.scopes) || card.scopes.length === 0) {
      throw new CardRegistrationError(`card "${card.moduleId}": scopes must be a non-empty array`);
    }
    const seen = new Set<string>();
    for (const s of card.scopes) {
      if (!s.screenId || typeof s.screenId !== 'string') throw new CardRegistrationError(`card "${card.moduleId}": scope screenId missing`);
      if (typeof s.actionId !== 'string') throw new CardRegistrationError(`card "${card.moduleId}": scope "${s.screenId}" actionId must be a string ('' allowed)`);
      const k = `${s.screenId}/${s.actionId}`;
      if (seen.has(k)) throw new CardRegistrationError(`card "${card.moduleId}": duplicate scope "${k}"`);
      seen.add(k);
      if (!s.label) throw new CardRegistrationError(`card "${card.moduleId}": scope "${k}" label missing`);
      if (!Array.isArray(s.classifications) || s.classifications.length === 0) {
        throw new CardRegistrationError(`card "${card.moduleId}": scope "${k}" needs at least one classification`);
      }
      const cs = new Set<string>();
      for (const c of s.classifications) {
        if (!c.id || !c.label) throw new CardRegistrationError(`card "${card.moduleId}": scope "${k}" classification needs id + label`);
        if (cs.has(c.id)) throw new CardRegistrationError(`card "${card.moduleId}": scope "${k}" duplicate classification "${c.id}"`);
        cs.add(c.id);
      }
    }
    this.cards.set(card.moduleId, card);
  }

  getCard(moduleId: string): ApprovalCard | undefined { return this.cards.get(moduleId); }

  /** Scope must be one the card declared; classification optional check. */
  findScope(scope: Scope): { card: ApprovalCard; scope: ApprovalCard['scopes'][number] } | undefined {
    const card = this.cards.get(scope.moduleId);
    if (!card) return undefined;
    const s = card.scopes.find((x) => x.screenId === scope.screenId && x.actionId === scope.actionId);
    return s ? { card, scope: s } : undefined;
  }

  /** Merged tree for the admin screen. */
  tree(): RegistryTree {
    return {
      modules: Array.from(this.cards.values()).map((c) => ({
        moduleId: c.moduleId,
        label: c.label,
        scopes: c.scopes.map((sc) => ({ screenId: sc.screenId, actionId: sc.actionId, label: sc.label, classifications: sc.classifications })),
      })),
    };
  }
}
