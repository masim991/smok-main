import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { clearTrackingData } from '@/components/services/storage/TrackingRepository';
import { localTestMode, LOCAL_TEST_USER_ID } from '@/lib/localTest';

// 인증된 사용자 최소 정보 모델
type AuthUser = {
  id: string;
  email?: string | null;
  nickname?: string | null;
};

// Auth 전역 컨텍스트가 제공하는 기능의 타입 정의
interface AuthContextType {
  startLocalTest: () => void;
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>; // 이메일/비밀번호 로그인
  signUp: (email: string, password: string, nickname?: string) => Promise<{ error?: string; emailSent?: boolean }>; // 회원가입
  signOut: () => Promise<void>; // 로그아웃
  updateNickname: (nickname: string) => Promise<{ error?: string }>; // 닉네임 업데이트
  deleteAccount: () => Promise<{ error?: string }>; // 계정 삭제
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱 시작/세션 변경 시 현재 로그인 사용자 상태 동기화
  useEffect(() => {
    let mounted = true;
    let authRevision = 0;

    const init = async () => {
      try {
        const revision = authRevision;
        if (!isSupabaseConfigured || localTestMode) return;
        const { data, error } = await supabase.auth.getSession();
        if (error || !mounted || revision !== authRevision) return;
        const u = data.session?.user ?? null;
        setUser(u ? { id: u.id, email: u.email, nickname: (u.user_metadata as any)?.nickname ?? null } : null);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted || localTestMode) return;
      authRevision++;
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email, nickname: (u.user_metadata as any)?.nickname ?? null } : null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 이메일/비밀번호 로그인
  const signIn = async (email: string, password: string) => {
    if (localTestMode) return { error: '로컬 테스트 버튼을 이용해주세요. 실제 로그인은 서버 연결 후 사용할 수 있습니다.' };
    if (!isSupabaseConfigured) return { error: '서버 연결 설정이 필요합니다. 관리자에게 문의해주세요.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) return { error: '이메일과 비밀번호를 확인해주세요.' };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return {};
    } catch (e: any) {
      return { error: e?.message || 'Sign-in failed' };
    }
  };

  // 회원가입: user_metadata에 닉네임 저장 + profiles 테이블 upsert
  const signUp = async (
    email: string,
    password: string,
    nickname?: string
  ): Promise<{ error?: string; emailSent?: boolean }> => {
    if (localTestMode) return { error: '로컬 테스트에서는 실제 계정을 만들지 않습니다.' };
    if (!isSupabaseConfigured) return { error: '서버 연결 설정이 필요합니다.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8) return { error: '올바른 이메일과 8자 이상의 비밀번호를 입력해주세요.' };
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname ?? null,
            avatar_url: '', // 나중에 프로필 이미지 업로드용
            updated_at: new Date().toISOString(),
          },
        },
      });

      if (signUpError) {
        return { error: signUpError.message };
      }

      // 회원가입 성공 시 profiles 테이블에 추가 정보 저장
      if (data.user && data.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            nickname: nickname ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('프로필 저장 중 오류 발생:', profileError);
          // 프로필 저장 실패해도 회원가입 성공으로 처리
        }
      }

      return { emailSent: !data.session };
    } catch (e: any) {
      console.error('회원가입 오류:', e);
      return { error: e?.message || '회원가입 중 오류가 발생했습니다.' };
    }
  };

  // 로그아웃
  const signOut = async () => {
    if (localTestMode) { setUser(null); return; }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // 닉네임 업데이트: auth.user_metadata 갱신 후 로컬 상태 동기화
  const updateNickname = async (nickname: string) => {
    nickname = nickname.trim();
    if (!nickname || nickname.length > 40) return { error: '닉네임은 1~40자로 입력해주세요.' };
    if (localTestMode) { setUser(current => current ? { ...current, nickname } : null); return {}; }
    try {
      const { error, data } = await supabase.auth.updateUser({ data: { nickname } });
      if (error) return { error: error.message };
      const u = data.user;
      setUser(u ? { id: u.id, email: u.email, nickname: (u.user_metadata as any)?.nickname ?? null } : null);
      return {};
    } catch (e: any) {
      return { error: e?.message || 'Update failed' };
    }
  };

  // 계정 삭제: 앱 데이터(entries/goals/profiles) 삭제 후 Edge Function으로 auth.users 삭제 시도
  const deleteAccount = async (): Promise<{ error?: string }> => {
    if (localTestMode) { try { await clearTrackingData(LOCAL_TEST_USER_ID); setUser(null); return {}; } catch { return { error: '로컬 테스트 기록을 지우지 못했습니다.' }; } }
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return { error: 'Not authenticated' };

      // Server verifies the JWT and deletes auth.users with cascading owned rows.
      const result = await supabase.functions.invoke('delete-user', { body: {} });
      if (result.error || result.data?.deleted !== true) {
        return { error: '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요. 계속 실패하면 관리자에게 문의해주세요.' };
      }
      let cleanupError = false;
      try { await clearTrackingData(uid); } catch { cleanupError = true; }
      try { await supabase.auth.signOut({ scope: 'local' }); } finally { setUser(null); }
      if (cleanupError) return { error: '서버 계정은 삭제되었습니다. 기기에 남은 저장 데이터를 지우려면 앱 데이터를 초기화해주세요.' };
      return {};
    } catch (e: any) {
      return { error: e?.message || 'Delete failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        startLocalTest: () => { if (localTestMode) setUser({ id: LOCAL_TEST_USER_ID, nickname: '로컬 테스트' }); },
        isAuthenticated: !!user,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        updateNickname,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
