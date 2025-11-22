import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// 인증된 사용자 최소 정보 모델
type AuthUser = {
  id: string;
  email?: string | null;
  nickname?: string | null;
};

// Auth 전역 컨텍스트가 제공하는 기능의 타입 정의
interface AuthContextType {
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

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const u = data.session?.user ?? null;
        setUser(u ? { id: u.id, email: u.email, nickname: (u.user_metadata as any)?.nickname ?? null } : null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
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
    setLoading(true);
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
      if (data.user) {
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

      return { emailSent: true };
    } catch (e: any) {
      console.error('회원가입 오류:', e);
      return { error: e?.message || '회원가입 중 오류가 발생했습니다.' };
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // 닉네임 업데이트: auth.user_metadata 갱신 후 로컬 상태 동기화
  const updateNickname = async (nickname: string) => {
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
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return { error: 'Not authenticated' };

      const delEntries = supabase.from('entries').delete().eq('user_id', uid);
      const delGoals = supabase.from('goals').delete().eq('user_id', uid);
      const delProfile = supabase.from('profiles').delete().eq('id', uid);
      const results = await Promise.allSettled([delEntries, delGoals, delProfile]);
      const rejected = results.find((r) => r.status === 'rejected');
      if (rejected) return { error: 'Failed to delete some data' };

      // Attempt to call Edge Function to fully delete auth user (requires server setup with service role)
      try {
        await supabase.functions.invoke('delete-user', { body: {} });
      } catch (e) {
        // ignore; client-side may not have function configured
        console.log('[Delete] Edge function delete-user not available or failed');
      }

      await supabase.auth.signOut();
      setUser(null);
      return {};
    } catch (e: any) {
      return { error: e?.message || 'Delete failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
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
