import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type SafeUser } from "@shared/schema";
import { type KeyPair, getKeysFromStorage } from "./crypto";

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  keyPair: KeyPair | null;
  login: (user: SafeUser, token: string, keyPair: KeyPair) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("archer_token");
    const storedUser = localStorage.getItem("archer_user");

    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const keys = getKeysFromStorage(parsedUser.username);

      if (keys) {
        setToken(storedToken);
        setUser(parsedUser);
        setKeyPair(keys);
      }
    }

    setIsLoading(false);
  }, []);

  const login = (newUser: SafeUser, newToken: string, newKeyPair: KeyPair) => {
    setUser(newUser);
    setToken(newToken);
    setKeyPair(newKeyPair);
    localStorage.setItem("archer_token", newToken);
    localStorage.setItem("archer_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setKeyPair(null);
    localStorage.removeItem("archer_token");
    localStorage.removeItem("archer_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, keyPair, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
