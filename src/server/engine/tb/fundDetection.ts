export type FundRule = { accountRegex: string; captureGroup: number; enabled: boolean };

export function detectFund(account: string, rules: FundRule[]): string | null {
  for (const r of rules) {
    if (!r.enabled) continue;
    const re = new RegExp(r.accountRegex);
    const m = re.exec(account);
    if (m && m[r.captureGroup]) return m[r.captureGroup];
  }
  return null;
}
