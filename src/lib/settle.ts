import type { Expense } from './types'

/**
 * Who owes whom, worked out from the expense list.
 *
 * All arithmetic happens in integer cents. Splitting S$10 three ways in
 * floating point gives you 3.3333… each and a total that is not S$10, and
 * those fractions of a cent accumulate into a settlement that does not
 * balance. Cents plus a remainder that lands on real people avoids that
 * entirely: every split sums back to exactly the bill.
 */

export interface Share {
  name: string
  cents: number
}

export interface Ledger {
  people: string[]
  /** Cash each person actually laid out. */
  paid: Record<string, number>
  /** Value each person actually consumed. */
  owed: Record<string, number>
  /** paid − owed. Positive means the group owes them. */
  net: Record<string, number>
  totalCents: number
  /** Entries the ledger had to guess about, because they predate the roster. */
  assumed: number
}

export interface Transfer {
  from: string
  to: string
  cents: number
}

export const toCents = (n: number): number => Math.round(n * 100)
export const toMoney = (cents: number): number => cents / 100

/** Split evenly, giving the odd cents to the first people rather than losing them. */
export function splitCents(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(Math.abs(total) / n)
  let rem = Math.abs(total) - base * n
  const sign = total < 0 ? -1 : 1
  return Array.from({ length: n }, () => {
    const extra = rem > 0 ? 1 : 0
    rem -= extra
    return sign * (base + extra)
  })
}

/** Everyone who got value out of this expense, and how much each. */
export function beneficiaries(e: Expense, people: string[]): Share[] {
  const total = toCents(e.amount)
  const payer = e.paidBy || people[0] || 'Me'

  if (e.forWhom === 'personal') return [{ name: payer, cents: total }]

  if (e.forWhom === 'split') {
    // A custom split is already per-person; trust it, but make it sum to the
    // bill so the ledger balances even if the shares were entered loosely.
    if (e.shares?.length) {
      const named = e.shares.map((s) => ({ name: s.name, cents: toCents(s.amount) }))
      const sum = named.reduce((a, b) => a + b.cents, 0)
      if (sum !== total && named.length) named[named.length - 1].cents += total - sum
      return named
    }
    const names = e.splitWith?.length
      ? e.splitWith
      : people.slice(0, Math.max(1, e.splitCount ?? people.length))
    return splitCents(total, names.length).map((c, i) => ({ name: names[i], cents: c }))
  }

  // Paid on behalf of others: the payer consumed none of it.
  const names = e.onBehalfOf?.length ? e.onBehalfOf : people.filter((p) => p !== payer)
  if (!names.length) return [{ name: payer, cents: total }]
  return splitCents(total, names.length).map((c, i) => ({ name: names[i], cents: c }))
}

/** True when this entry predates the roster and had to be interpreted. */
export function wasAssumed(e: Expense): boolean {
  if (!e.paidBy) return true
  if (e.forWhom === 'split' && !e.shares?.length && !e.splitWith?.length) return true
  if (e.forWhom === 'onbehalf' && !e.onBehalfOf?.length) return true
  return false
}

export function buildLedger(expenses: Expense[], people: string[]): Ledger {
  const paid: Record<string, number> = {}
  const owed: Record<string, number> = {}
  const seen = new Set(people)
  let totalCents = 0
  let assumed = 0

  for (const p of people) {
    paid[p] = 0
    owed[p] = 0
  }

  for (const e of expenses) {
    const cents = toCents(e.amount)
    totalCents += cents
    if (wasAssumed(e)) assumed++

    const payer = e.paidBy || people[0] || 'Me'
    seen.add(payer)
    paid[payer] = (paid[payer] ?? 0) + cents

    for (const b of beneficiaries(e, people)) {
      seen.add(b.name)
      owed[b.name] = (owed[b.name] ?? 0) + b.cents
    }
  }

  // Anyone who only shows up inside a custom split still belongs in the ledger.
  const all = [...people, ...[...seen].filter((n) => !people.includes(n))]
  const net: Record<string, number> = {}
  for (const p of all) {
    paid[p] = paid[p] ?? 0
    owed[p] = owed[p] ?? 0
    net[p] = paid[p] - owed[p]
  }

  return { people: all, paid, owed, net, totalCents, assumed }
}

/**
 * Fewest transfers that clear the balances: repeatedly settle the largest
 * debtor against the largest creditor. Not provably minimal in every case —
 * that is NP-hard — but for a handful of people it is optimal in practice and
 * always produces at most (people − 1) payments.
 */
export function settle(net: Record<string, number>): Transfer[] {
  const creditors = Object.entries(net)
    .filter(([, c]) => c > 0)
    .map(([name, cents]) => ({ name, cents }))
  const debtors = Object.entries(net)
    .filter(([, c]) => c < 0)
    .map(([name, cents]) => ({ name, cents: -cents }))

  creditors.sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
  debtors.sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))

  const out: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].cents, creditors[j].cents)
    if (amount > 0) out.push({ from: debtors[i].name, to: creditors[j].name, cents: amount })
    debtors[i].cents -= amount
    creditors[j].cents -= amount
    if (debtors[i].cents === 0) i++
    if (creditors[j].cents === 0) j++
  }
  // Sub-cent noise should never surface as a payment.
  return out.filter((t) => t.cents > 0)
}

export function formatSgd(cents: number): string {
  return `S$${(Math.abs(cents) / 100).toFixed(2)}`
}
