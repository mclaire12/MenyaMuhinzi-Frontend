import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CurrentUserResponse, Permission, UserRole } from "@/lib/api/types";
import { toAppRoles, isStaffRole, type AppRole } from "@/lib/auth/app-roles";
import { isUnavailableAuthError, parseBffError } from "@/lib/auth/parse-bff-error";
import {
  bffGetCurrentUser,
  bffLogin,
  bffLogout,
  bffRestoreSession,
  type BffLoginResult,
} from "@/lib/auth/auth-server-fns";

type AuthState = {
  user: CurrentUserResponse | null;
  loading: boolean;
  isAuthenticated: boolean;
  sessionUnavailable: boolean;
  roles: AppRole[];
  apiRoles: UserRole[];
  permissions: Permission[];
  isStaff: boolean;
  login: (identifier: string, password: string) => Promise<BffLoginResult>;
  refreshUser: () => Promise<CurrentUserResponse | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAuthenticated: false,
  sessionUnavailable: false,
  roles: [],
  apiRoles: [],
  permissions: [],
  isStaff: false,
  login: async () => {
    throw new Error("AuthProvider is missing");
  },
  refreshUser: async () => null,
  signOut: async () => {},
});

async function loadSession(): Promise<{ user: CurrentUserResponse | null; unavailable: boolean }> {
  try {
    const user = await bffRestoreSession();
    return { user, unavailable: false };
  } catch (error) {
    const parsed = parseBffError(error);
    if (isUnavailableAuthError(parsed)) return { user: null, unavailable: true };
    return { user: null, unavailable: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const restoreStarted = useRef(false);

  const apiRoles = user?.roles ?? [];
  const roles = useMemo(() => toAppRoles(apiRoles), [apiRoles]);
  const permissions = user?.permissions ?? [];
  const isStaff = isStaffRole(roles);
  const isAuthenticated = user !== null && user.status === "ACTIVE";

  const refreshUser = useCallback(async () => {
    try {
      const next = await bffGetCurrentUser();
      setUser(next);
      setSessionUnavailable(false);
      return next;
    } catch (error) {
      const parsed = parseBffError(error);
      if (isUnavailableAuthError(parsed)) {
        setSessionUnavailable(true);
        return null;
      }
      setUser(null);
      setSessionUnavailable(false);
      return null;
    }
  }, []);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    void (async () => {
      const restored = await loadSession();
      setUser(restored.user);
      setSessionUnavailable(restored.unavailable);
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await bffLogin({ data: { identifier, password } });
    try {
      const full = await bffGetCurrentUser();
      setUser(full);
    } catch {
      setUser({
        ...result.user,
        permissions: [],
        location: null,
        farmerProfile: null,
        facilitatorProfile: null,
      });
    }
    setSessionUnavailable(false);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await bffLogout();
    } finally {
      setUser(null);
      setSessionUnavailable(false);
    }
  }, []);

  const value: AuthState = {
    user,
    loading,
    isAuthenticated,
    sessionUnavailable,
    roles,
    apiRoles,
    permissions,
    isStaff,
    login,
    refreshUser,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);