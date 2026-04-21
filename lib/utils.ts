import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const KST = 'Asia/Seoul';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKstDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, KST, 'yyyy-MM-dd HH:mm:ss');
}

export function formatKstDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, KST, 'yyyy-MM-dd');
}

export function fmtNumber(v: number): string {
  if (v === 0) return '-';
  return v.toLocaleString('ko-KR');
}
export function fmtRate(v: number): string {
  if (v === 0) return '-';
  return `${v.toFixed(1)}%`;
}
