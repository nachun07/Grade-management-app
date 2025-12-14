// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { 
  setSession, 
  getSession, 
  hashPasscode, 
  TEACHER_USER_ID 
} from "@/lib/auth"; 

// スタイル定義 (省略せず再掲)
const styles: any = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
  },
  card: {
    background: "white",
    padding: 32,
    borderRadius: 12,
    width: 350,
    textAlign: "center",
    boxShadow: "0 10px 20px rgba(0,0,0,0.15)",
  },
  title: {
    fontSize: 24,
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
    transition: "background 0.2s",
  },
  linkButton: { 
    background: "none",
    border: "none",
    color: "#4f46e5",
    cursor: "pointer",
    marginTop: 5,
    marginBottom: 10,
    fontSize: 12,
    textDecoration: "underline",
  },
  error: {
    color: "#ef4444",
    backgroundColor: "#fee2e2",
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    fontSize: 14,
    textAlign: "center",
  },
  success: {
    color: "#10b981",
    backgroundColor: "#d1fae5",
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    fontSize: 14,
    textAlign: "center",
  }
};


export default function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [userId, setUserId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(""); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  const router = useRouter();

  // ✅ 認証状態の監視 (カスタムセッションチェック)
  useEffect(() => {
    const session = getSession();
    if (session) {
      if (session.id === TEACHER_USER_ID) {
        // 先生セッションの場合は先生ダッシュボードへ
        router.push("/teacher-dashboard");
      } else {
        // 生徒セッションの場合は生徒ダッシュボードへ
        router.push("/dashboard");
      }
    }
  }, [router]);


  // ✅ ログイン処理 (Firestoreベース)
  const handleLogin = async () => {
    setError("");
    setSuccessMessage("");
    if (!userId || !passcode) {
        setError("IDとパスコードを入力してください。");
        return;
    }
    
    setIsLoading(true);
    try {
      // 1. user_profilesから該当IDのドキュメントを取得
      const userDocRef = doc(db, "user_profiles", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setError("ユーザーIDが見つかりません。");
        setIsLoading(false);
        return;
      }

      const userData = userDocSnap.data();
      const enteredPasscodeHash = hashPasscode(passcode);
      
      // 2. パスコードの検証 (ハッシュ化された値で比較)
      if (userData.passcode !== enteredPasscodeHash) {
        setError("パスコードが違います。");
        setIsLoading(false);
        return;
      }
      
      // 3. 認証成功: セッションを設定し、リダイレクト
      setSession(userId, passcode);
      router.push("/dashboard");

    } catch (err: any) {
      console.error(err);
      setError("ログイン処理中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ 新規登録処理 (Firestoreベース)
  const handleRegister = async () => {
    setError("");
    setSuccessMessage("");
    if (!name || !userId || !passcode || !birthDate) {
        setError("全ての項目を入力してください。");
        return;
    }
    if (passcode.length < 4) {
        setError("パスコードは4文字以上で設定してください。");
        return;
    }
    
    // ID重複チェック
    const checkDoc = await getDoc(doc(db, "user_profiles", userId));
    if (checkDoc.exists()) {
        setError("そのユーザーIDは既に使用されています。別のIDを入力してください。");
        return;
    }

    setIsLoading(true);
    try {
      const passcodeHash = hashPasscode(passcode);

      // ユーザープロファイルをFirestoreに保存
      await setDoc(doc(db, "user_profiles", userId), {
        name,
        passcode: passcodeHash, // ★ パスコードを保存
        birthDate,
        createdAt: new Date(),
      });
      
      // 登録成功: セッションを設定し、リダイレクト
      setSession(userId, passcode);
      router.push("/dashboard");

    } catch (err: any) {
      console.error(err);
      setError("登録に失敗しました。入力内容をご確認ください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          {isRegisterMode ? "📝 生徒新規登録" : "👨‍🎓 生徒ログイン"}
        </h1>

        {error && <p style={styles.error}>{error}</p>}
        {successMessage && <p style={styles.success}>{successMessage}</p>}

        {isRegisterMode && (
          <input
            style={styles.input}
            placeholder="ユーザー名 (表示名)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />
        )}
        
        <input
          style={styles.input}
          placeholder={isRegisterMode ? "ユーザーID (ログイン用)" : "ユーザーID"}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={isLoading}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="パスコード (4文字以上)"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          disabled={isLoading}
        />
        
        {isRegisterMode && (
            <input
                style={styles.input}
                type="date"
                placeholder="生年月日"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={isLoading}
            />
        )}
        
        <button 
          style={{...styles.button, opacity: isLoading ? 0.7 : 1}} 
          onClick={isRegisterMode ? handleRegister : handleLogin} 
          disabled={isLoading}
        >
          {isLoading 
            ? "処理中..." 
            : isRegisterMode ? "新規登録" : "ログイン"
          }
        </button>
        
        {/* モード切り替えボタン */}
        <button 
          style={styles.linkButton} 
          onClick={() => {
            setIsRegisterMode(!isRegisterMode);
            setError("");
            setSuccessMessage("");
            setPasscode("");
          }}
        >
          {isRegisterMode 
            ? "アカウントをお持ちですか？ ログインへ" 
            : "アカウントをお持ちでない方 新規登録へ"
          }
        </button>

        {/* 先生ログインへの案内 */}
        <button 
            style={{...styles.linkButton, color: '#f97316'}} 
            onClick={() => router.push('/teacher-admin')}
        >
            先生はこちらからログイン
        </button>
        
      </div>
    </div>
  );
}