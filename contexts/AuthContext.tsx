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
  authError: string | null;
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
  const [authError, setAuthError] = useState<string | null>(null);

  // 앱 시작/세션 변경 시 현재 로그인 사용자 상태 동기화
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setAuthError(null);
        const u = data.session?.user ?? null;
        setUser(u ? { id: u.id, email: u.email, nickname: (u.user_metadata as any)?.nickname ?? null } : null);
      } catch (error) {
        if (mounted) setAuthError(error instanceof Error ? error.message : String(error));
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

        if (profileError) return { error: `Account created, but profile save failed: ${profileError.message}` };
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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

  // Only the server function can confirm complete account deletion.
  const deleteAccount = async (): Promise<{ error?: string }> => {
    try {
      const { data, error: getUserError } = await supabase.auth.getUser();
      if (getUserError) return { error: getUserError.message };
      const uid = data.user?.id;
      if (!uid) return { error: 'Not authenticated' };
      const result = await supabase.functions.invoke('delete-user', { body: {} });
      if (result.error) return { error: result.error.message };
      if (result.data?.deleted !== true || result.data?.userId !== uid) {
        return { error: 'Server did not confirm account deletion' };
      }
      const signOutResult = await supabase.auth.signOut();
      if (signOutResult.error) return { error: `Account deleted, but sign-out failed: ${signOutResult.error.message}` };
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
        authError,
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
