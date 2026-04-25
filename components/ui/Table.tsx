import { ReactNode } from 'react';
import { EmptyState } from './patterns';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyField?: keyof T;
  emptyLabel?: string;
}

export default function Table<T extends Record<string, any>>({ columns, rows, keyField, emptyLabel }: Props<T>) {
  if (!rows || rows.length === 0) return <EmptyState title={emptyLabel || 'لا توجد بيانات'} icon={undefined} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map(c => (
              <th key={c.key} className={`px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-${c.align || 'right'}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={keyField ? String(row[keyField]) : i} className="hover:bg-gray-50/60 transition-colors">
              {columns.map(c => (
                <td key={c.key} className={`px-5 py-3.5 text-gray-700 text-${c.align || 'right'}`}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
