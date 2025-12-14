"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase"; 

// ⭐ 先生専用の認証情報
const TEACHER_USER_NAME = "先生"; 
const TEACHER_PASSWORD_CODE = "123456"; 
const TEACHER_EMAIL = "teacher@example.com"; // 内部的なFirebaseアカウント

// スタイル定義 (app/page.tsxと同じものを使用)
const styles: any = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #4f46e5, #3b82f6)", // 色を生徒と変えて区別
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
    background: "#f97316", // 先生ボタンの色を変える
    color: "white",
    border: "none",
    borderRadius: 6,
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: 10,
    transition: "background 0.2s",
  },
  error: {
    color: "#ef4444",
    backgroundColor: "#fee2e2",
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    fontSize: 14,
    textAlign: "center",
  }
};


export default function TeacherAdminLogin() {
  const [username, setUsername] = useState(TEACHER_USER_NAME); // ユーザー名は固定で表示
  const [password, setPassword] = useState(""); // パスワードは空で開始
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // ✅ 認証状態の監視 (ログイン済みなら先生ダッシュボードへ)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (u && u.email === TEACHER_EMAIL) {
        // 先生アカウントでログイン済みの場合のみ、先生ダッシュボードへ遷移
        router.push("/teacher-dashboard"); 
      }
      // 生徒アカウントがここに迷い込んだ場合は何もしない（未ログイン扱い）
    });
    return () => unsub();
  }, [router]);

  // ✅ 先生専用ログイン処理
  const handleTeacherLogin = async () => {
    setError("");
    setIsLoading(true);
    let success = false;

    // 1. フロントエンドでユーザー名とパスワードを検証
    if (username !== TEACHER_USER_NAME || password !== TEACHER_PASSWORD_CODE) {
        setError("ユーザー名またはパスワードが違います。");
        setIsLoading(false);
        return;
    }

    try {
        // 2. Firebase Authに内部アカウントでログイン試行
        await signInWithEmailAndPassword(auth, TEACHER_EMAIL, TEACHER_PASSWORD_CODE);
        success = true;

    } catch (err: any) {
        if (err.code === "auth/user-not-found") {
             setError("先生アカウントのFirebase登録が完了していません。");
        } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
             setError("パスワードが違います。");
        } else {
             setError("認証中に予期せぬエラーが発生しました。");
             console.error(err);
        }
    } finally {
      setIsLoading(false);
      if (success) {
        // ⭐⭐⭐ 修正点: 先生専用ダッシュボードにリダイレクト ⭐⭐⭐
        router.push("/teacher-dashboard"); 
      }
    }
  };


  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>👨‍🏫 先生ログイン (専用)</h1>

        {error && <p style={styles.error}>{error}</p>}

        <input
          style={styles.input}
          placeholder="ユーザー名 (先生)"
          value={username}
          // 先生専用画面なので、ユーザー名は常に固定で、入力はさせない (readOnly)
          readOnly 
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
          onClick={handleTeacherLogin} 
          disabled={isLoading}
        >
          {isLoading ? "処理中..." : "先生としてログイン"}
        </button>

      </div>
    </div>
  );
}