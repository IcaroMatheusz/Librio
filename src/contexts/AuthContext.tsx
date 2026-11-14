import { createContext, useContext, useState, type ReactNode } from "react";

interface User {
    id: number, 
    name: string,
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    function login(user: User) {
        setUser(user);
    }

    function logout() {
        setUser(null);
    }

    const isAuthenticated = user !== null;

    return (
        <AuthContext.Provider
        value={{ user, isAuthenticated, login, logout}}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth deve ser usado dentro de AuthProvider");
    }

    return context;
}

