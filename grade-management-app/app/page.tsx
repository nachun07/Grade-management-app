"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase"; 

// スタイル定義 (省略せず再掲)
const styles: any = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  },
  card: {
    background: "white",
    padding: 32,
    borderRadius: 12,
    width: 320,
    textAlign: "center",
    boxShadow: "0 10px 20px rgba(0,0,0,0.15)",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "1px solid #ccc",
    marginBottom: 12,
    fontSize: 14,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: 10,
    background: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: 6,
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: 10,
  },
  registerText: {
    marginTop: 15,
    fontSize: 14,
  },
  registerLink: {
    color: "#4f46e5",
    cursor: "pointer",
    fontWeight: "bold",
  },
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // ✅ ユーザー名＋パスワードログイン（総当たり認証）
  const login = async () => {
    if (!username || !password) {
      alert("ユーザー名とパスワードを入力してください");
      return;
    }

    setIsLoading(true);
    let success = false;
    
    try {
        // 1. Firestoreで、入力されたユーザー名に一致するすべてのアカウントを検索
        const q = query(collection(db, "user_profiles"), where("name", "==", username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("ユーザー名またはパスワードが間違っています");
            setIsLoading(false);
            return;
        }

        // 2. 該当する全てのアカウントのメールアドレスで総当たり認証を試行
        for (const userDoc of querySnapshot.docs) {
            const userData = userDoc.data();
            const internalEmail = userData.email;
            
            try {
                // Firebase Authによる認証試行
                await signInWithEmailAndPassword(auth, internalEmail, password);
                success = true;
                break; // 成功したらただちにループを抜けて、ログインを確定
            } catch (err: any) {
                // パスワード不一致 (auth/invalid-credential) の場合は、次のアカウントを試す
                if (err.code !== "auth/invalid-credential") {
                    console.error("Firebase Auth Error:", err);
                    throw err; 
                }
            }
        }

        if (success) {
            router.push("/dashboard");
        } else {
            alert("ユーザー名またはパスワードが間違っています");
        }
        
    } catch (err) {
        alert("ログインに失敗しました");
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>ログイン</h1>

        <input
          style={styles.input}
          placeholder="ユーザー名" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />

        <button 
          style={{...styles.button, opacity: isLoading ? 0.7 : 1}} 
          onClick={login} 
          disabled={isLoading}
        >
          {isLoading ? "処理中..." : "ログイン"}
        </button>

        <p style={styles.registerText}>
          アカウントをお持ちでない方は{" "}
          <span
            style={styles.registerLink}
            onClick={() => !isLoading && router.push("/register")}
          >
            新規登録
          </span>
        </p>
      </div>
    </div>
  );
}