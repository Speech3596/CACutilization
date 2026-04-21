import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = createSupabaseServerClient();

  let campusName: string | null = null;
  if (profile.campus_id) {
    const { data } = await supabase.from('campuses').select('name').eq('id', profile.campus_id).single();
    campusName = data?.name ?? null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav profile={profile} campusName={campusName} />
      <main className="container mx-auto py-6 flex-1">{children}</main>
      <footer className="border-t py-4 text-xs text-muted-foreground">
        <div className="container mx-auto flex items-center justify-between">
          <span>© CANB · CAC 접속 로그 리포트</span>
          <span>Supabase + Next.js + shadcn/ui</span>
        </div>
      </footer>
    </div>
  );
}
