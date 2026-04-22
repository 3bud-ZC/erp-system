/**
 * Accounting API
 */

import { apiClient } from './client';
import type { Account, JournalEntry, TrialBalanceReport, BalanceSheetReport, ProfitAndLossReport } from '@/lib/types/accounting';
import type { PaginationParams, PaginatedResult } from '@/lib/types/common';

export const accountingApi = {
  // Accounts
  getAccounts: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<Account>>('/accounting/accounts');
  },

  getAccount: async (id: string) => {
    return apiClient.get<Account>(`/accounting/accounts/${id}`);
  },

  // Journal Entries
  getJournalEntries: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<JournalEntry>>('/accounting/journal-entries');
  },

  getJournalEntry: async (id: string) => {
    return apiClient.get<JournalEntry>(`/accounting/journal-entries/${id}`);
  },

  createJournalEntry: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<JournalEntry>('/accounting/journal-entries', data, idempotencyKey);
  },

  postJournalEntry: async (id: string) => {
    return apiClient.post<JournalEntry>(`/accounting/journal-entries/${id}/post`);
  },

  reverseJournalEntry: async (id: string) => {
    return apiClient.post<JournalEntry>(`/accounting/journal-entries/${id}/reverse`);
  },

  // Reports
  getTrialBalance: async (options?: { fiscalYearId?: string; accountingPeriodId?: string; asOfDate?: Date }) => {
    return apiClient.get<TrialBalanceReport>('/accounting/reports/trial-balance');
  },

  getBalanceSheet: async (asOfDate?: Date) => {
    return apiClient.get<BalanceSheetReport>('/accounting/reports/balance-sheet');
  },

  getProfitAndLoss: async (options?: { startDate?: Date; endDate?: Date }) => {
    return apiClient.get<ProfitAndLossReport>('/accounting/reports/profit-loss');
  },
};
