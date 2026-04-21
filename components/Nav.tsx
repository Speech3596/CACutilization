'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Role } from '@/lib/supabase/types';
import { LogOut } from 'lucide-react';

interface Props {
  profile: { email: string; full_name: string | null; role: Role; campus_id: number | null };
  campusName?: string | null;
}

export function Nav({ profile, campusName }: Props) {
  const path = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const items: Array<{ href: string; label: string; roles: Role[] }> = [
    { href: '/',            label: '대시보드',   roles: ['admin','hq_viewer','campus_manager'] },
    { href: '/reports',     label: '리포트',     roles: ['admin','hq_viewer','campus_manager'] },
    { href: '/reports/my',  label: '내 리포트',  roles: ['admin','hq_viewer','campus_manager'] },
    { href: '/admin/uploads', label: '업로드 관리', roles: ['admin'] },
    { href: '/admin/users',   label: '계정 관리',  roles: ['admin'] }
  ];
  const visible = items.filter((i) => i.roles.includes(profile.role));

  const roleLabel =
    profile.role === 'admin' ? '관리자'
    : profile.role === 'hq_viewer' ? '본사 뷰어'
    : `캠퍼스 매니저${campusName ? ` · ${campusName}` : ''}`;

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="container mx-auto flex h-14 items-center gap-6">
        <Link href="/" className="font-bold text-primary">CANB · CAC</Link>
        <nav className="flex items-center gap-1">
          {visible.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                path === i.href || (i.href !== '/' && path.startsWith(i.href))
                  ? 'bg-accent text-accent-foreground font-medium'
                  : ''
              )}
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="text-right leading-tight">
            <div className="font-medium">{profile.full_name ?? profile.email}</div>
            <div className="text-xs text-muted-foreground">{roleLabel}</div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> 로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}
