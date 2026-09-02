'use client';

/* eslint-disable react-hooks/set-state-in-effect -- modal fields intentionally synchronize when account/type choices change */

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type Currency = 'KRW' | 'CAD';
type TxType = 'Expense' | 'Income' | 'Transfer' | 'Borrow' | 'Repayment';
type View = 'dashboard' | 'accounts' | 'transactions' | 'loans' | 'reports';

type Account = {
  id: string; name: string; currency: Currency; openingBalance: number;
  role: 'spending' | 'bridge' | 'external'; includeInCash: boolean;
};

type Transaction = {
  id: string; type: TxType; date: string; description: string; category?: string;
  fromAccountId?: string; toAccountId?: string; sentAmount?: number; receivedAmount?: number;
  fee?: number; exchangeRate?: number; loanId?: string;
};

type Loan = {
  id: string; name: string; date: string; lenderAccountId: string; borrowedIntoAccountId: string;
  repayFromAccountId: string; repayToAccountId: string; originalKRW: number; settlementCAD: number; note?: string;
};

type WalletData = { version: number; accounts: Account[]; transactions: Transaction[]; loans: Loan[]; cadKrwRate: number };
type TxPreset = { type: TxType; fromAccountId?: string; toAccountId?: string; simple?: boolean };
const ACCOUNT_TX_TYPES: TxType[] = ['Income', 'Transfer', 'Expense'];
const ACCOUNT_TX_LABEL: Record<(typeof ACCOUNT_TX_TYPES)[number], string> = { Income: '입금', Transfer: '송금', Expense: '지출' };

const DEFAULT_DATA: WalletData = {
  version: 2,
  cadKrwRate: 1033.22,
  accounts: [
    { id: 'a1', name: '한국 CAD 통장', currency: 'CAD', openingBalance: 0, role: 'spending', includeInCash: true },
    { id: 'a2', name: '한국 원화 통장', currency: 'KRW', openingBalance: 0, role: 'bridge', includeInCash: true },
    { id: 'a3', name: 'Canada Main', currency: 'CAD', openingBalance: 0, role: 'spending', includeInCash: true },
    { id: 'a4', name: '한국 가족 계좌', currency: 'KRW', openingBalance: 0, role: 'external', includeInCash: false },
    { id: 'a5', name: 'Canada Repayment', currency: 'CAD', openingBalance: 0, role: 'external', includeInCash: false },
  ],
  loans: [{ id: 'loan-001', name: '가족 대여금', date: '2026-07-10', lenderAccountId: 'a4', borrowedIntoAccountId: 'a2', repayFromAccountId: 'a3', repayToAccountId: 'a5', originalKRW: 10000000, settlementCAD: 9620, note: '실제 캐나다 수령액을 기준으로 상환' }],
  transactions: [
    { id: 'initial-a1', type: 'Income', date: '2026-07-01', description: '초기 입금', category: '초기 잔액', toAccountId: 'a1', receivedAmount: 2480 },
    { id: 'initial-a2', type: 'Income', date: '2026-07-01', description: '초기 입금', category: '초기 잔액', toAccountId: 'a2', receivedAmount: 2400000 },
    { id: 'initial-a3', type: 'Income', date: '2026-07-01', description: '초기 입금', category: '초기 잔액', toAccountId: 'a3', receivedAmount: 3340 },
    { id: 'initial-a4', type: 'Income', date: '2026-07-01', description: '초기 입금', category: '초기 잔액', toAccountId: 'a4', receivedAmount: 12000000 },
    { id: 't1', type: 'Borrow', date: '2026-07-10', description: '가족 대여금 입금', fromAccountId: 'a4', toAccountId: 'a2', sentAmount: 10000000, receivedAmount: 10000000, loanId: 'loan-001' },
    { id: 't2', type: 'Transfer', date: '2026-07-12', description: '캐나다 생활비 송금', fromAccountId: 'a2', toAccountId: 'a3', sentAmount: 5000000, receivedAmount: 4810, fee: 15000, exchangeRate: 1039.5, loanId: 'loan-001' },
    { id: 't3', type: 'Repayment', date: '2026-08-01', description: '1차 대여금 상환', fromAccountId: 'a3', toAccountId: 'a5', sentAmount: 2500, receivedAmount: 2500, loanId: 'loan-001' },
    { id: 't4', type: 'Repayment', date: '2026-08-20', description: '2차 대여금 상환', fromAccountId: 'a3', toAccountId: 'a5', sentAmount: 2500, receivedAmount: 2500, loanId: 'loan-001' },
    { id: 't5', type: 'Repayment', date: '2026-09-01', description: '9월 대여금 상환', fromAccountId: 'a3', toAccountId: 'a5', sentAmount: 1000, receivedAmount: 1000, loanId: 'loan-001' },
    { id: 't6', type: 'Expense', date: '2026-09-01', description: 'Metro Groceries', category: '식비', fromAccountId: 'a3', sentAmount: 86.4 },
    { id: 't7', type: 'Expense', date: '2026-08-31', description: '한국 온라인 결제', category: '쇼핑', fromAccountId: 'a1', sentAmount: 52.75 },
    { id: 't8', type: 'Expense', date: '2026-08-29', description: 'TTC Monthly Pass', category: '교통', fromAccountId: 'a3', sentAmount: 156 },
    { id: 't9', type: 'Income', date: '2026-08-28', description: '급여', category: '급여', toAccountId: 'a3', receivedAmount: 3200 },
    { id: 't10', type: 'Transfer', date: '2026-09-01', description: '해외 송금 도착', fromAccountId: 'a2', toAccountId: 'a3', sentAmount: 3000000, receivedAmount: 2890, fee: 15000, exchangeRate: 1038.06 },
  ],
};

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: '대시보드', icon: '⌂' }, { id: 'accounts', label: '계좌', icon: '▣' },
  { id: 'transactions', label: '거래', icon: '⇄' }, { id: 'loans', label: '대여금', icon: '◎' },
  { id: 'reports', label: '리포트', icon: '▥' },
];

const TYPE_LABEL: Record<TxType, string> = { Expense: '지출', Income: '입금', Transfer: '송금', Borrow: '입금', Repayment: '상환' };
const TYPE_CLASS: Record<TxType, string> = { Expense: 'expense', Income: 'income', Transfer: 'transfer', Borrow: 'income', Repayment: 'repay' };
const FILTERS = ['All', 'Income', 'Transfer', 'Expense'] as const;
const APP_VERSION = '0.2.0';
const APP_VERSION_KEY = 'money-flow-app-version';
const ROLE_LABEL: Record<Account['role'], string> = { spending: '입금 · 송금 · 지출', bridge: '입금 · 송금 · 지출', external: '입금 · 송금 · 지출' };
const ROLE_NAME: Record<Account['role'], string> = { spending: '지출 계좌', bridge: '경유 계좌', external: '외부 계좌' };

function loanUsesAccount(loan: Loan, id: string) {
  return [loan.lenderAccountId, loan.borrowedIntoAccountId, loan.repayFromAccountId, loan.repayToAccountId].includes(id);
}

function pickAccountId(accounts: Account[], predicate: (account: Account) => boolean) {
  return accounts.find(predicate)?.id || accounts[0]?.id || '';
}

function money(value: number, currency: Currency, compact = false) {
  if (!Number.isFinite(value)) value = 0;
  if (currency === 'KRW') return `${compact ? '₩' : '₩'}${Math.round(value).toLocaleString('ko-KR')}`;
  return `C$${value.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function accountBalance(account: Account, transactions: Transaction[]) {
  return transactions.reduce((balance, tx) => {
    if (tx.fromAccountId === account.id) balance -= (tx.sentAmount || 0) + (tx.fee || 0);
    if (tx.toAccountId === account.id) balance += tx.receivedAmount || 0;
    return balance;
  }, account.openingBalance);
}

function migrateWalletData(raw: WalletData & { version?: number }): WalletData {
  if ((raw.version || 1) >= 2) return { ...raw, version: 2 };
  const openingTransactions: Transaction[] = raw.accounts.flatMap((account): Transaction[] => {
    if (!account.openingBalance) return [];
    if (account.openingBalance > 0) return [{ id: `opening-${account.id}`, type: 'Income', date: '2026-01-01', description: '기존 잔액 이관', category: '초기 잔액', toAccountId: account.id, receivedAmount: account.openingBalance }];
    return [{ id: `opening-${account.id}`, type: 'Expense', date: '2026-01-01', description: '기존 잔액 이관', category: '초기 잔액', fromAccountId: account.id, sentAmount: Math.abs(account.openingBalance) }];
  });
  return {
    ...raw,
    version: 2,
    accounts: raw.accounts.map(account => ({ ...account, openingBalance: 0 })),
    transactions: [...openingTransactions, ...raw.transactions],
  };
}

function download(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function parseCsvLine(line: string) {
  const cells: string[] = []; let current = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { current += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(current); current = ''; }
    else current += char;
  }
  cells.push(current); return cells;
}

export default function Home() {
  const [data, setData] = useState<WalletData>(DEFAULT_DATA);
  const [view, setView] = useState<View>('dashboard');
  const [hydrated, setHydrated] = useState(false);
  const [txPreset, setTxPreset] = useState<TxPreset | null>(null);
  const [loanOpen, setLoanOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<Account | 'new' | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [toast, setToast] = useState('');
  const [installEvent, setInstallEvent] = useState<Event | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const saved = localStorage.getItem('money-flow-v1'); if (saved) setData(migrateWalletData(JSON.parse(saved))); } catch { /* keep sample data */ }
    const previousVersion = localStorage.getItem(APP_VERSION_KEY);
    localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
    setHydrated(true);
    if (previousVersion && previousVersion !== APP_VERSION) setToast(`앱이 ${APP_VERSION}으로 업데이트되었어요.`);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', beforeInstall);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem('money-flow-v1', JSON.stringify(data)); }, [data, hydrated]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const balances = useMemo(() => Object.fromEntries(data.accounts.map(a => [a.id, accountBalance(a, data.transactions)])), [data]);
  const cashCAD = useMemo(() => data.accounts.filter(a => a.includeInCash).reduce((sum, a) => sum + (a.currency === 'CAD' ? balances[a.id] : balances[a.id] / data.cadKrwRate), 0), [data, balances]);
  const repayments = useMemo(() => Object.fromEntries(data.loans.map(loan => [loan.id, data.transactions.filter(t => t.type === 'Repayment' && t.loanId === loan.id).reduce((sum, t) => sum + (t.sentAmount || 0), 0)])), [data]);
  const outstanding = data.loans.reduce((sum, loan) => sum + Math.max(0, loan.settlementCAD - (repayments[loan.id] || 0)), 0);
  const spendingAccounts = data.accounts.filter(a => a.role === 'spending');
  const spendingIds = new Set(spendingAccounts.map(a => a.id));
  const monthExpense = data.transactions.filter(t => t.type === 'Expense' && t.date.startsWith('2026-09') && spendingIds.has(t.fromAccountId || '')).reduce((sum, t) => sum + (t.sentAmount || 0), 0);
  const spendingTransactions = data.transactions.filter(t => t.type === 'Expense' && spendingIds.has(t.fromAccountId || ''));
  const filteredTransactions = data.transactions.filter(t => filter === 'All' || (filter === 'Income' ? t.type === 'Income' || t.type === 'Borrow' : t.type === filter)).sort((a, b) => b.date.localeCompare(a.date));
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    spendingTransactions.forEach(t => { totals[t.category || '기타'] = (totals[t.category || '기타'] || 0) + (t.sentAmount || 0); });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [spendingTransactions]);
  const maxCategory = Math.max(...categoryTotals.map(([, value]) => value), 1);

  const accountName = (id?: string) => data.accounts.find(a => a.id === id)?.name || '외부';
  const accountCurrency = (id?: string): Currency => data.accounts.find(a => a.id === id)?.currency || 'CAD';
  const showToast = (message: string) => setToast(message);
  const go = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openTransaction = (preset: TxPreset) => { setSelectedAccount(null); setTxPreset(preset); };

  const backup = () => { download(`money-flow-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json'); showToast('JSON 백업을 저장했어요.'); };
  const exportCsv = () => {
    const keys: (keyof Transaction)[] = ['id', 'type', 'date', 'description', 'category', 'fromAccountId', 'toAccountId', 'sentAmount', 'receivedAmount', 'fee', 'exchangeRate', 'loanId'];
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [keys.join(','), ...data.transactions.map(tx => keys.map(key => escape(tx[key])).join(','))].join('\n');
    download(`money-flow-transactions-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8'); showToast('CSV를 저장했어요.');
  };

  const restoreJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => {
      try {
        const restored = JSON.parse(String(reader.result));
        if (!Array.isArray(restored.accounts) || !Array.isArray(restored.transactions) || !Array.isArray(restored.loans)) throw new Error('invalid');
        setData(migrateWalletData(restored)); showToast('백업을 복원했어요.');
      } catch { showToast('올바른 Money Flow 백업 파일이 아니에요.'); }
    }; reader.readAsText(file); event.target.value = '';
  };

  const importCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => {
      try {
        const lines = String(reader.result).replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        const headers = parseCsvLine(lines[0]);
        const imported = lines.slice(1).map(line => {
          const values = parseCsvLine(line); const row = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
          return { id: row.id || crypto.randomUUID(), type: row.type as TxType, date: row.date, description: row.description, category: row.category || undefined, fromAccountId: row.fromAccountId || undefined, toAccountId: row.toAccountId || undefined, sentAmount: row.sentAmount ? Number(row.sentAmount) : undefined, receivedAmount: row.receivedAmount ? Number(row.receivedAmount) : undefined, fee: row.fee ? Number(row.fee) : undefined, exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : undefined, loanId: row.loanId || undefined } as Transaction;
        }).filter(tx => Object.keys(TYPE_LABEL).includes(tx.type) && tx.date && tx.description);
        setData(current => ({ ...current, transactions: [...current.transactions.filter(old => !imported.some(tx => tx.id === old.id)), ...imported] }));
        showToast(`${imported.length}개 거래를 가져왔어요.`);
      } catch { showToast('CSV 형식을 확인해 주세요.'); }
    }; reader.readAsText(file); event.target.value = '';
  };

  const install = async () => {
    if (!installEvent) { showToast('브라우저 메뉴에서 “홈 화면에 추가”를 선택하세요.'); return; }
    await (installEvent as Event & { prompt: () => Promise<void> }).prompt(); setInstallEvent(null);
  };

  const renderDashboard = () => {
    const totalLoan = data.loans.reduce((sum, loan) => sum + loan.settlementCAD, 0);
    const totalPaid = data.loans.reduce((sum, loan) => sum + (repayments[loan.id] || 0), 0);
    const progress = totalLoan ? Math.min(100, totalPaid / totalLoan * 100) : 100;
    return <>
      <PageHeader eyebrow="2026년 9월" title="오늘의 자금 흐름을 확인하세요." action={() => openTransaction({ type: 'Expense', simple: true })} actionLabel="＋ 거래 추가" />
      <div className="metric-grid">
        <Metric label="현금 자산" value={money(cashCAD, 'CAD')} note={`적용 환율 1 CAD = ${money(data.cadKrwRate, 'KRW')}`} tone="green" />
        <Metric label="남은 대여금" value={money(outstanding, 'CAD')} note={`${(100 - progress).toFixed(1)}% 남음`} tone="gold" />
        <Metric label="순자산" value={money(cashCAD - outstanding, 'CAD')} note="현금 자산 − 남은 대여금" />
        <Metric label="이번 달 소비" value={money(monthExpense, 'CAD')} note="주요 지출 계좌 통합" />
      </div>
      <div className="main-grid">
        <article className="panel loan-panel">
          <PanelHeading eyebrow="LOAN LEDGER" title={data.loans[0]?.name || '대여금 없음'} action="자세히" onAction={() => go('loans')} />
          {data.loans[0] ? <>
            <div className="loan-amount"><strong>{money(repayments[data.loans[0].id] || 0, 'CAD')}</strong><span> / {money(data.loans[0].settlementCAD, 'CAD')} 상환</span></div>
            <div className="progress"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-meta"><span>{progress.toFixed(1)}% 완료</span><b>{money(outstanding, 'CAD')} 남음</b></div>
            <div className="loan-route"><span>{accountName(data.loans[0].lenderAccountId)}</span><b>→</b><span>{accountName(data.loans[0].borrowedIntoAccountId)}</span><b>→</b><span>{accountName(data.loans[0].repayFromAccountId)}</span><b>→</b><span>{accountName(data.loans[0].repayToAccountId)}</span></div>
          </> : <Empty text="등록된 대여금이 없어요." />}
        </article>
        <article className="panel">
          <PanelHeading eyebrow="RECENT" title="최근 거래" action="전체 보기" onAction={() => go('transactions')} />
          <div className="transaction-list">{filteredTransactions.slice(0, 5).map(tx => <TransactionRow key={tx.id} tx={tx} accountName={accountName} accountCurrency={accountCurrency} />)}</div>
        </article>
      </div>
      <section className="panel accounts-strip">
        <PanelHeading eyebrow="ACCOUNTS" title="계좌별 잔액" action="계좌 관리" onAction={() => go('accounts')} />
        <div className="mini-accounts">{data.accounts.map((account, index) => <button className="mini-account" key={account.id} onClick={() => setSelectedAccount(account)}><span className={`account-dot dot-${index % 5}`} /><span><small>{account.name}</small><strong>{money(balances[account.id], account.currency)}</strong></span></button>)}</div>
      </section>
    </>;
  };

  const renderAccounts = () => <>
    <PageHeader eyebrow="ACCOUNTS" title="모든 계좌" subtitle="계좌를 추가하거나 선택해 입금·송금·지출을 기록하세요." action={() => setAccountForm('new')} actionLabel="＋ 계좌 추가" />
    <div className="accounts-grid">{data.accounts.map((account, index) => <article className="account-card" key={account.id}>
      <div className="account-card-top"><span className={`account-emblem dot-${index % 5}`}>{index + 1}</span><button className="icon-button" aria-label={`${account.name} 편집`} onClick={() => setAccountForm(account)}>···</button></div>
      <button className="account-open" onClick={() => setSelectedAccount(account)}><span>{account.name}</span><strong>{money(balances[account.id], account.currency)}</strong>
      <span className="account-card-meta"><i>{account.currency}</i><i>{ROLE_LABEL[account.role]}</i></span><em>통장 선택 →</em></button>
    </article>)}
    <article className="account-card account-add-card"><button className="account-open" onClick={() => setAccountForm('new')}><span>＋</span><strong>계좌 추가</strong><em>새 통장 만들기</em></button></article>
    </div>
  </>;

  const renderTransactions = () => <>
    <PageHeader eyebrow="TRANSACTIONS" title="거래 내역" subtitle="입금·송금·지출만 기록합니다. 대여금은 입금에서 지정하세요." action={() => openTransaction({ type: 'Expense', simple: true })} actionLabel="＋ 거래 추가" />
    <div className="filter-row">{FILTERS.map(item => <button key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item === 'All' ? '전체' : TYPE_LABEL[item]}</button>)}</div>
    <section className="panel transaction-table">
      <div className="table-header"><span>거래</span><span>유형</span><span>날짜</span><span>금액</span></div>
      {filteredTransactions.map(tx => <TransactionRow key={tx.id} tx={tx} accountName={accountName} accountCurrency={accountCurrency} table />)}
      {!filteredTransactions.length && <Empty text="이 유형의 거래가 없어요." />}
    </section>
  </>;

  const renderLoans = () => <>
    <PageHeader eyebrow="LOAN LEDGER" title="대여금 상환 관리" subtitle="빌린 원화와 실제 정산된 캐나다 달러를 함께 보존합니다." action={() => setLoanOpen(true)} actionLabel="＋ 대여금 추가" />
    <div className="loans-grid">{data.loans.map(loan => {
      const paid = repayments[loan.id] || 0; const remaining = Math.max(0, loan.settlementCAD - paid); const pct = loan.settlementCAD ? Math.min(100, paid / loan.settlementCAD * 100) : 100;
      return <article className="loan-card" key={loan.id}>
        <div className="loan-card-title"><div><span className="pill">진행 중</span><h2>{loan.name}</h2><small>{loan.date} 시작</small></div><span className="loan-percent">{pct.toFixed(1)}%</span></div>
        <div className="progress large"><span style={{ width: `${pct}%` }} /></div>
        <div className="loan-stats"><div><small>빌린 금액</small><strong>{money(loan.originalKRW, 'KRW')}</strong></div><div><small>CAD 정산액</small><strong>{money(loan.settlementCAD, 'CAD')}</strong></div><div><small>상환 완료</small><strong>{money(paid, 'CAD')}</strong></div><div className="remaining"><small>남은 금액</small><strong>{money(remaining, 'CAD')}</strong></div></div>
        <div className="loan-route"><span>{accountName(loan.lenderAccountId)}</span><b>→</b><span>{accountName(loan.borrowedIntoAccountId)}</span><b>→</b><span>{accountName(loan.repayFromAccountId)}</span><b>→</b><span>{accountName(loan.repayToAccountId)}</span></div>
        <div className="repayment-history"><h3>상환 기록</h3>{data.transactions.filter(t => t.type === 'Repayment' && t.loanId === loan.id).sort((a,b) => b.date.localeCompare(a.date)).map(tx => <div key={tx.id}><span>{tx.date} · {tx.description}</span><b>{money(tx.sentAmount || 0, 'CAD')}</b></div>)}</div>
      </article>;
    })}</div>
    {!data.loans.length && <section className="panel"><Empty text="대여금을 추가하면 상환 진행률을 볼 수 있어요." /></section>}
  </>;

  const renderReports = () => <>
    <PageHeader eyebrow="REPORTS" title="통합 소비 리포트" subtitle={spendingAccounts.length ? `${spendingAccounts.map(a => a.name).join(' · ')}의 실제 지출만 합산합니다.` : '지출 계좌의 실제 지출만 합산합니다.'} />
    <div className="report-grid">
      <article className="panel chart-panel"><PanelHeading eyebrow="BY CATEGORY" title="카테고리별 소비" />
        <div className="bar-chart">{categoryTotals.map(([category, value]) => <div className="bar-row" key={category}><span>{category}</span><div><i style={{ width: `${value / maxCategory * 100}%` }} /></div><b>{money(value, 'CAD')}</b></div>)}</div>
      </article>
      <article className="panel summary-panel"><PanelHeading eyebrow="SPENDING ACCOUNTS" title="지출 계좌 비교" />
        {spendingAccounts.map(account => {
          const total = spendingTransactions.filter(t => t.fromAccountId === account.id).reduce((sum,t) => sum + (t.sentAmount || 0), 0);
          return <div className="spend-account" key={account.id}><div><span className="account-dot" /><div><strong>{account.name}</strong><small>{spendingTransactions.filter(t => t.fromAccountId === account.id).length}건</small></div></div><b>{money(total, account.currency)}</b></div>;
        })}
        <div className="report-total"><span>통합 소비 합계</span><strong>{money(spendingTransactions.reduce((sum,t)=>sum+(t.sentAmount||0),0), 'CAD')}</strong></div>
      </article>
    </div>
    <section className="panel data-panel"><PanelHeading eyebrow="YOUR DATA" title="백업 및 가져오기" />
      <p>앱 버전 {APP_VERSION}. 모든 데이터는 현재 기기의 브라우저에 저장됩니다. 정기적으로 백업 파일을 내려받아 보관하세요.</p>
      <div className="data-actions"><button className="secondary" onClick={backup}>JSON 백업</button><button className="secondary" onClick={() => restoreRef.current?.click()}>JSON 복원</button><button className="secondary" onClick={exportCsv}>CSV 내보내기</button><button className="secondary" onClick={() => csvRef.current?.click()}>CSV 가져오기</button></div>
    </section>
  </>;

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => go('dashboard')}><span className="brand-mark">M</span><span>Money Flow<small className="brand-version">v{APP_VERSION}</small></span></button>
      <nav aria-label="주 메뉴">{NAV.map(item => <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => go(item.id)}><span>{item.icon}</span><b>{item.label}</b></button>)}</nav>
      <div className="sidebar-tools"><button onClick={install}>앱 설치</button><button onClick={backup}>백업</button></div>
      <div className="privacy-note"><span className="status-dot" />이 기기에 안전하게 저장됨</div>
    </aside>
    <section className="content">{view === 'dashboard' && renderDashboard()}{view === 'accounts' && renderAccounts()}{view === 'transactions' && renderTransactions()}{view === 'loans' && renderLoans()}{view === 'reports' && renderReports()}</section>
    <button className="mobile-add" aria-label={view === 'accounts' ? '계좌 추가' : view === 'loans' ? '대여금 추가' : '거래 추가'} onClick={() => { if (view === 'accounts') setAccountForm('new'); else if (view === 'loans') setLoanOpen(true); else openTransaction({ type: 'Expense', simple: true }); }}>＋</button>
    <input ref={restoreRef} hidden type="file" accept="application/json,.json" onChange={restoreJson} /><input ref={csvRef} hidden type="file" accept="text/csv,.csv" onChange={importCsv} />
    {selectedAccount && <AccountDetailModal account={selectedAccount} balance={balances[selectedAccount.id]} transactions={data.transactions.filter(tx => tx.fromAccountId === selectedAccount.id || tx.toAccountId === selectedAccount.id)} accountName={accountName} accountCurrency={accountCurrency} onClose={() => setSelectedAccount(null)} onRename={name => { setData(current => ({ ...current, accounts: current.accounts.map(account => account.id === selectedAccount.id ? { ...account, name } : account) })); setSelectedAccount(current => current ? { ...current, name } : current); showToast('계좌 이름을 저장했어요.'); }} onDeposit={() => openTransaction({ type: 'Income', toAccountId: selectedAccount.id, simple: true })} onTransfer={() => openTransaction({ type: 'Transfer', fromAccountId: selectedAccount.id, toAccountId: data.accounts.find(account => account.id !== selectedAccount.id)?.id, simple: true })} onExpense={() => openTransaction({ type: 'Expense', fromAccountId: selectedAccount.id, simple: true })} />}
    {txPreset && <TransactionModal accounts={data.accounts} loans={data.loans} initialType={txPreset.type} initialFrom={txPreset.fromAccountId} initialTo={txPreset.toAccountId} simple={txPreset.simple} onClose={() => setTxPreset(null)} onSave={tx => { setData(current => ({ ...current, transactions: [...current.transactions, tx] })); setTxPreset(null); showToast('거래를 저장했어요.'); }} />}
    {loanOpen && <LoanModal accounts={data.accounts} onClose={() => setLoanOpen(false)} onSave={loan => { setData(current => ({ ...current, loans: [...current.loans, loan] })); setLoanOpen(false); showToast('대여금을 추가했어요.'); }} />}
    {accountForm !== null && <AccountModal account={accountForm === 'new' ? null : accountForm} loanBlocked={accountForm !== 'new' && data.loans.some(loan => loanUsesAccount(loan, accountForm.id))} relatedTxCount={accountForm === 'new' ? 0 : data.transactions.filter(tx => tx.fromAccountId === accountForm.id || tx.toAccountId === accountForm.id).length} onClose={() => setAccountForm(null)} onSave={account => { setData(current => ({ ...current, accounts: accountForm === 'new' ? [...current.accounts, account] : current.accounts.map(a => a.id === account.id ? account : a) })); setAccountForm(null); showToast(accountForm === 'new' ? '계좌를 추가했어요.' : '계좌 정보를 저장했어요.'); }} onDelete={accountForm === 'new' ? undefined : () => { const id = accountForm.id; setData(current => ({ ...current, accounts: current.accounts.filter(a => a.id !== id), transactions: current.transactions.filter(tx => tx.fromAccountId !== id && tx.toAccountId !== id) })); setSelectedAccount(current => current?.id === id ? null : current); setAccountForm(null); showToast('계좌를 삭제했어요.'); }} />}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </main>;
}

function PageHeader({ eyebrow, title, subtitle, action, actionLabel }: { eyebrow: string; title: string; subtitle?: string; action?: () => void; actionLabel?: string }) {
  return <header className="topbar"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div><div className="topbar-side"><span className="app-version" title={`Money Flow ${APP_VERSION}`}>v{APP_VERSION}</span>{action && <button className="primary desktop-action" onClick={action}>{actionLabel}</button>}</div></header>;
}

function Metric({ label, value, note, tone = '' }: { label: string; value: string; note: string; tone?: string }) { return <article className={`metric-card ${tone}`}><p>{label}</p><strong>{value}</strong><span>{note}</span></article>; }
function PanelHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <button className="text-button" onClick={onAction}>{action} →</button>}</div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><span>○</span><p>{text}</p></div>; }
function TransactionRow({ tx, accountName, accountCurrency, table = false }: { tx: Transaction; accountName: (id?: string) => string; accountCurrency: (id?: string) => Currency; table?: boolean }) {
  const incoming = tx.type === 'Income' || tx.type === 'Borrow';
  const outgoing = tx.type === 'Expense' || tx.type === 'Repayment';
  const value = outgoing || tx.type === 'Transfer' || tx.type === 'Borrow' ? (incoming ? tx.receivedAmount || tx.sentAmount : tx.sentAmount) : tx.receivedAmount;
  const currency = outgoing || (tx.type === 'Transfer' && !incoming) ? accountCurrency(tx.fromAccountId) : accountCurrency(tx.toAccountId || tx.fromAccountId);
  const route = tx.type === 'Expense' ? accountName(tx.fromAccountId) : incoming ? accountName(tx.toAccountId) : `${accountName(tx.fromAccountId)} → ${accountName(tx.toAccountId)}`;
  const loanMark = tx.loanId || tx.type === 'Borrow' ? ' · 대여금' : '';
  return <div className={table ? 'transaction table-row' : 'transaction'}>
    <span className={`tx-icon ${TYPE_CLASS[tx.type]}`}>{outgoing ? '↓' : incoming ? '↑' : tx.type === 'Repayment' ? '✓' : '↗'}</span>
    <div className="tx-main"><strong>{tx.description}</strong><small>{route}{tx.category ? ` · ${tx.category}` : ''}{loanMark}</small></div>
    {table && <span className={`type-pill ${TYPE_CLASS[tx.type]}`}>{TYPE_LABEL[tx.type]}</span>}
    {table && <time>{tx.date}</time>}
    <b className={outgoing ? 'negative' : incoming ? 'positive' : ''}>{outgoing ? '− ' : incoming ? '+ ' : ''}{money(value || 0, currency)}</b>
  </div>;
}

function TransactionModal({ accounts, loans, initialType, initialFrom, initialTo, onClose, onSave }: { accounts: Account[]; loans: Loan[]; initialType: TxType; initialFrom?: string; initialTo?: string; simple?: boolean; onClose: () => void; onSave: (tx: Transaction) => void }) {
  const types = ACCOUNT_TX_TYPES;
  const [type, setType] = useState<TxType>(ACCOUNT_TX_TYPES.includes(initialType) ? initialType : 'Income');
  const [from, setFrom] = useState(initialFrom || accounts[2]?.id || accounts[0]?.id || '');
  const [to, setTo] = useState(initialTo || accounts.find(account => account.id !== initialFrom)?.id || accounts[0]?.id || '');
  const [sent, setSent] = useState(''); const [received, setReceived] = useState('');
  const [rate, setRate] = useState(''); const [isLoan, setIsLoan] = useState(false); const [loanId, setLoanId] = useState(loans[0]?.id || '');
  const fromAccount = accounts.find(a => a.id === from); const toAccount = accounts.find(a => a.id === to);
  const fromCurrency = fromAccount?.currency || 'CAD'; const toCurrency = toAccount?.currency || 'CAD';
  const isTransfer = type === 'Transfer';
  const isIncome = type === 'Income';
  const isDual = type === 'Transfer';
  const sameCurrency = fromCurrency === toCurrency;
  useEffect(() => {
    if (isDual && !sameCurrency) { setRate(''); setReceived(''); }
  }, [from, isDual, sameCurrency, to]);
  useEffect(() => {
    if (!isDual) return;
    if (from === to) {
      const alternative = accounts.find(account => account.id !== from);
      if (alternative) setTo(alternative.id);
      return;
    }
    const sentValue = Number(sent); const rateValue = Number(rate);
    if (sameCurrency) setReceived(sent);
    else if (sentValue > 0 && rateValue > 0) {
      const converted = fromCurrency === 'KRW' ? sentValue / rateValue : sentValue * rateValue;
      setReceived(toCurrency === 'KRW' ? converted.toFixed(0) : converted.toFixed(2));
    } else setReceived('');
  }, [accounts, from, fromCurrency, isDual, rate, sameCurrency, sent, to, toCurrency, type]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const date = String(form.get('date') || '');
    if (!date) return;
    if (isTransfer) {
      const sentValue = Number(sent); const receivedValue = sameCurrency ? sentValue : Number(received);
      if (!(sentValue > 0) || !(receivedValue > 0) || from === to) return;
      if (!sameCurrency && !(Number(rate) > 0)) return;
      onSave({ id: crypto.randomUUID(), type, date, description: `${fromAccount?.name || '계좌'} → ${toAccount?.name || '계좌'}`, fromAccountId: from, toAccountId: to, sentAmount: sentValue, receivedAmount: receivedValue, exchangeRate: sameCurrency ? 1 : Number(rate) });
      return;
    }
    const description = String(form.get('description') || '').trim();
    if (!description) return;
    const tx: Transaction = { id: crypto.randomUUID(), type, date, description, category: String(form.get('category') || '') || undefined };
    if (type === 'Expense') { tx.fromAccountId = from; tx.sentAmount = Number(sent); }
    else { tx.toAccountId = to; tx.receivedAmount = Number(received || sent); if (isLoan && loanId) { tx.loanId = loanId; tx.category = tx.category || '대여금'; } }
    onSave(tx);
  };
  const accountOptions = (excludeId?: string) => accounts.filter(account => account.id !== excludeId).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>);
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="tx-title"><div className="modal-head"><div><p className="eyebrow">NEW TRANSACTION</p><h2 id="tx-title">{isTransfer ? '송금' : '거래 추가'}</h2></div><button className="close" onClick={onClose} aria-label="닫기">×</button></div>
    <form onSubmit={submit}><div className="type-selector simple">{types.map(item => <button type="button" key={item} onClick={() => setType(item)} className={type === item ? 'active' : ''}>{ACCOUNT_TX_LABEL[item]}</button>)}</div>
      {isTransfer ? <>
        <label>날짜<input required name="date" type="date" defaultValue="2026-09-01" /></label>
        <label>금액 ({fromCurrency})<input required min="0" step="any" inputMode="decimal" value={sent} onChange={e => setSent(e.target.value)} type="number" /></label>
        <label>현재 통장<select value={from} onChange={e => setFrom(e.target.value)}>{accountOptions()}</select></label>
        <label>대상 통장<select value={to} onChange={e => setTo(e.target.value)}>{accountOptions(from)}</select></label>
        {sameCurrency ? <div className="conversion-note"><span>동일 통화</span><strong>같은 금액이 대상 통장으로 이동합니다.</strong></div>
          : <label>환율 (1 CAD = KRW)<input required min="0" step="any" placeholder="이번 송금의 환율 입력" value={rate} onChange={e => setRate(e.target.value)} type="number" />
            {received && <small className="field-help">{money(Number(sent) || 0, fromCurrency)} → {money(Number(received) || 0, toCurrency)}</small>}</label>}
      </> : <>
        <div className="form-grid"><label>날짜<input required name="date" type="date" defaultValue="2026-09-01" /></label><label>설명<input required name="description" placeholder={isIncome ? '예: 급여, 대여금' : '예: 장보기'} /></label></div>
        <label>카테고리<input name="category" placeholder={isIncome ? '급여, 대여금 등' : '식비, 교통 등'} /></label>
        {isIncome ? <label>입금할 통장<select value={to} onChange={e => setTo(e.target.value)}>{accountOptions()}</select></label>
          : <label>현재 통장 (출금)<select value={from} onChange={e => setFrom(e.target.value)}>{accountOptions()}</select></label>}
        <label>{isIncome ? `받은 금액 (${toCurrency})` : `보낸 금액 (${fromCurrency})`}<input required min="0" step="any" inputMode="decimal" value={isIncome ? received : sent} onChange={e => isIncome ? setReceived(e.target.value) : setSent(e.target.value)} type="number" /></label>
        {isIncome && <>
          <label className="check"><input type="checkbox" checked={isLoan} onChange={e => setIsLoan(e.target.checked)} /><span>대여금으로 지정</span></label>
          {isLoan && (loans.length ? <label>대여금<select value={loanId} onChange={e => setLoanId(e.target.value)}>{loans.map(loan => <option key={loan.id} value={loan.id}>{loan.name}</option>)}</select></label> : <p className="form-note">등록된 대여금이 없어요. 대여금 탭에서 먼저 추가하세요.</p>)}
        </>}
      </>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button className="primary" type="submit">{isTransfer ? '송금하기' : '거래 저장'}</button></div>
    </form></section></div>;
}

function AccountDetailModal({ account, balance, transactions, accountName, accountCurrency, onClose, onRename, onDeposit, onTransfer, onExpense }: { account: Account; balance: number; transactions: Transaction[]; accountName: (id?: string) => string; accountCurrency: (id?: string) => Currency; onClose: () => void; onRename: (name: string) => void; onDeposit: () => void; onTransfer: () => void; onExpense: () => void }) {
  const [name, setName] = useState(account.name);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  useEffect(() => { setName(account.name); }, [account.name]);
  const commitName = () => {
    const next = name.trim();
    if (!next) { setName(account.name); return; }
    if (next !== account.name) onRename(next);
  };
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal account-detail" role="dialog" aria-modal="true" aria-labelledby="account-detail-title"><div className="modal-head"><div className="account-title-block"><p className="eyebrow">ACCOUNT</p><input id="account-detail-title" className="account-title-input" value={name} onChange={event => setName(event.target.value)} onBlur={commitName} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setName(account.name); event.currentTarget.blur(); } }} aria-label="계좌 이름" /><p className="account-title-hint">이름을 눌러 바로 수정</p></div><button className="close" onClick={onClose} aria-label="닫기">×</button></div>
    <div className="detail-balance"><span>현재 잔액 · {account.currency}</span><strong>{money(balance, account.currency)}</strong><small>기준 금액 0 · 모든 금액은 거래로 계산</small></div>
    <div className="account-actions"><button className="action-deposit" onClick={onDeposit}><span>＋</span><b>입금</b><small>일반 · 대여금 지정</small></button><button className="action-transfer" onClick={onTransfer}><span>↗</span><b>송금</b><small>다른 통장으로</small></button><button className="action-expense" onClick={onExpense}><span>−</span><b>지출</b><small>내역 기록</small></button></div>
    <div className="detail-history"><div className="detail-history-title"><h3>이 통장의 최근 출납</h3><span>{transactions.length}건</span></div>{recent.length ? recent.map(tx => <TransactionRow key={tx.id} tx={tx} accountName={accountName} accountCurrency={accountCurrency} />) : <Empty text="입금부터 시작해 보세요." />}</div>
  </section></div>;
}

function AccountModal({ account, loanBlocked, relatedTxCount, onClose, onSave, onDelete }: { account: Account | null; loanBlocked?: boolean; relatedTxCount?: number; onClose: () => void; onSave: (account: Account) => void; onDelete?: () => void }) {
  const isNew = !account;
  const [role, setRole] = useState<Account['role']>(account?.role ?? 'spending');
  const [includeInCash, setIncludeInCash] = useState(account?.includeInCash ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    onSave({ id: account?.id || crypto.randomUUID(), name, currency: account?.currency || (String(form.get('currency')) as Currency), openingBalance: 0, role, includeInCash });
  };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal small" role="dialog" aria-modal="true"><div className="modal-head"><div><p className="eyebrow">{isNew ? 'NEW ACCOUNT' : 'EDIT ACCOUNT'}</p><h2>{isNew ? '계좌 추가' : '계좌 정보 편집'}</h2></div><button className="close" onClick={onClose} aria-label="닫기">×</button></div>
    <form onSubmit={submit}>
      <label>계좌 이름<input required name="name" defaultValue={account?.name || ''} placeholder="예: 비상금 통장" /></label>
      {isNew ? <div className="form-grid"><label>통화<select name="currency" defaultValue="CAD"><option value="CAD">CAD</option><option value="KRW">KRW</option></select></label><label>역할<select value={role} onChange={e => { const next = e.target.value as Account['role']; setRole(next); setIncludeInCash(next !== 'external'); }}>{(Object.keys(ROLE_NAME) as Account['role'][]).map(item => <option key={item} value={item}>{ROLE_NAME[item]}</option>)}</select></label></div>
        : account && <><div className="readonly-info"><span>통화</span><strong>{account.currency}</strong></div><label>역할<select value={role} onChange={e => setRole(e.target.value as Account['role'])}>{(Object.keys(ROLE_NAME) as Account['role'][]).map(item => <option key={item} value={item}>{ROLE_NAME[item]}</option>)}</select></label></>}
      <label className="check"><input type="checkbox" checked={includeInCash} onChange={e => setIncludeInCash(e.target.checked)} /><span>대시보드 현금 자산에 포함</span></label>
      <p className="form-note">잔액은 0에서 시작하며 입금·송금·지출 내역으로만 계산됩니다.</p>
      {loanBlocked && <p className="form-note">대여금에 연결된 계좌는 삭제할 수 없어요. 대여금을 먼저 정리하세요.</p>}
      {confirmDelete && onDelete ? <>
        <p className="delete-warning">{relatedTxCount ? `이 계좌와 연결된 거래 ${relatedTxCount}건도 함께 삭제됩니다.` : '이 계좌를 삭제할까요?'}</p>
        <div className="modal-actions"><button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>돌아가기</button><button type="button" className="danger" onClick={onDelete}>계좌 삭제</button></div>
      </> : <div className="modal-actions">
        {onDelete && <button type="button" className="danger-ghost" disabled={loanBlocked} onClick={() => setConfirmDelete(true)}>삭제</button>}
        <button type="button" className="secondary" onClick={onClose}>취소</button>
        <button className="primary">{isNew ? '계좌 추가' : '저장'}</button>
      </div>}
    </form>
  </section></div>;
}

function LoanModal({ accounts, onClose, onSave }: { accounts: Account[]; onClose: () => void; onSave: (loan: Loan) => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave({ id: crypto.randomUUID(), name: String(f.get('name')), date: String(f.get('date')), lenderAccountId: String(f.get('lender')), borrowedIntoAccountId: String(f.get('borrowedInto')), repayFromAccountId: String(f.get('repayFrom')), repayToAccountId: String(f.get('repayTo')), originalKRW: Number(f.get('originalKRW')), settlementCAD: Number(f.get('settlementCAD')), note: String(f.get('note')) }); };
  const accountSelect = (name: string, defaultValue: string) => <select name={name} defaultValue={accounts.some(a => a.id === defaultValue) ? defaultValue : accounts[0]?.id}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>;
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><p className="eyebrow">NEW LOAN</p><h2>대여금 추가</h2></div><button className="close" onClick={onClose}>×</button></div><form onSubmit={submit}><div className="form-grid"><label>대여금 이름<input required name="name" placeholder="예: 가족 대여금 2" /></label><label>시작일<input required type="date" name="date" defaultValue="2026-09-01" /></label></div><div className="form-grid"><label>원화 대여액<input required type="number" name="originalKRW" /></label><label>CAD 정산액<input required step="any" type="number" name="settlementCAD" /></label></div><div className="form-grid"><label>빌려준 계좌{accountSelect('lender', pickAccountId(accounts, a => a.role === 'external' && a.currency === 'KRW'))}</label><label>대여금 받은 계좌{accountSelect('borrowedInto', pickAccountId(accounts, a => a.role === 'bridge'))}</label><label>상환 출금 계좌{accountSelect('repayFrom', pickAccountId(accounts, a => a.role === 'spending' && a.currency === 'CAD'))}</label><label>최종 상환 계좌{accountSelect('repayTo', pickAccountId(accounts, a => a.role === 'external' && a.currency === 'CAD'))}</label></div><label>메모<input name="note" placeholder="상환 기준이나 약속" /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button className="primary">대여금 저장</button></div></form></section></div>;
}
