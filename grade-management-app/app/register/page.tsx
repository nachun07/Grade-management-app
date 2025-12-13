"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

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
  back: {
    marginTop: 10,
    fontSize: 14,
    color: "#4f46e5",
    cursor: "pointer",
    fontWeight: "bold",
  },
};

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ 共通関数: ユニークなメールアドレスを生成
  const generateUniqueEmail = () => {
    return `u${Date.now()}${Math.random().toString(36).substring(2, 8)}@scoreapp.local`;
  };

  // ✅ ユーザー名とパスワードで新規登録
  const handleRegister = async () => {
    if (!username || !password) {
      alert("ユーザー名とパスワードを入力してください");
      return;
    }

    if (password.length < 6) { 
      alert("パスワードは6文字以上にしてください");
      return;
    }

    const internalEmail = generateUniqueEmail(); 

    try {
      setLoading(true);
      
      // 1. Firebase Authで登録
      const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
      const uid = userCredential.user.uid;

      // 2. Firestoreにユーザー名とUIDのマッピングを保存
      await setDoc(doc(db, "user_profiles", uid), {
          name: username,         
          email: internalEmail,   
          createdAt: new Date(),
      });

      router.push("/dashboard");
    } catch (e: any) {
      console.error(e);
      alert("登録に失敗しました: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>新規登録</h1>

        <input
          style={styles.input}
          placeholder="ユーザー名 (重複可)" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="パスワード（6文字以上）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />

        <button
          style={{...styles.button, opacity: loading ? 0.7 : 1}}
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? "登録中..." : "ユーザー名で登録"}
        </button>

        <p
          style={styles.back}
          onClick={() => !loading && router.push("/")}
        >
          ログイン画面へ戻る
        </p>
      </div>
    </div>
  );
}