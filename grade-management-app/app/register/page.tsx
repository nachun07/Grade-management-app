"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

// スタイル定義 (再掲)
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

// 🛠️ ヘルパー関数の定義
const CURRENT_YEAR = new Date().getFullYear();
const generateYears = () => {
  const years = [];
  for (let i = CURRENT_YEAR; i >= CURRENT_YEAR - 100; i--) {
    years.push(i);
  }
  return years;
};
const generateMonths = () => {
  const months = [];
  for (let i = 1; i <= 12; i++) {
    months.push(i.toString().padStart(2, '0'));
  }
  return months;
};
const generateDays = (year: string, month: string) => {
    const daysInMonth = (y: number, m: number) => {
        if (m === 2) {
            return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
        } else if ([4, 6, 9, 11].includes(m)) {
            return 30;
        } else {
            return 31;
        }
    };
    const maxDay = daysInMonth(parseInt(year) || CURRENT_YEAR, parseInt(month) || 1);
    const days = [];
    for (let i = 1; i <= maxDay; i++) {
        days.push(i.toString().padStart(2, '0'));
    }
    return days;
};
const YEARS = generateYears();
const MONTHS = generateMonths();
// ------------------------------

const GENDERS = ['男性', '女性', 'その他']; // 性別オプション

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  // ⭐ 生年月日を3つのステートに分割
  const [birthYear, setBirthYear] = useState("");  
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [gender, setGender] = useState("");     
  const [loading, setLoading] = useState(false);

  // ✅ 共通関数: ユニークなメールアドレスを生成
  const generateUniqueEmail = () => {
    return `u${Date.now()}${Math.random().toString(36).substring(2, 8)}@scoreapp.local`;
  };

  // ✅ ユーザー名と追加情報で新規登録
  const handleRegister = async () => {
    // ⭐ バリデーションチェックを3つのステートに合わせる
    if (!username || !password || !birthYear || !birthMonth || !birthDay || !gender) {
      alert("すべての情報を入力してください");
      return;
    }

    if (password.length < 6) { 
      alert("パスワードは6文字以上にしてください");
      return;
    }

    const internalEmail = generateUniqueEmail(); 
    // ⭐ Firestoreに保存する形式 (YYYY-MM-DD) に結合
    const birthdayString = `${birthYear}-${birthMonth}-${birthDay}`;

    try {
      setLoading(true);
      
      const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "user_profiles", uid), {
          name: username,         
          email: internalEmail,   
          birthday: birthdayString, // ⭐ 結合した文字列を保存
          gender: gender,         
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
          placeholder="ユーザー名 (表示名・重複可)" 
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
        
        {/* ⭐ 生年月日選択フォーム */}
        <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
            {/* 年 */}
            <select 
              style={{...styles.input, flex: 1}} 
              value={birthYear} 
              onChange={(e) => setBirthYear(e.target.value)}
              disabled={loading}
            >
                <option value="">年</option>
                {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            
            {/* 月 */}
            <select 
              style={{...styles.input, flex: 1}} 
              value={birthMonth} 
              onChange={(e) => setBirthMonth(e.target.value)}
              disabled={loading}
            >
                <option value="">月</option>
                {MONTHS.map(m => <option key={m} value={m}>{parseInt(m)}月</option>)}
            </select>

            {/* 日 (年と月が選択されている場合にのみ正しく生成) */}
            <select 
              style={{...styles.input, flex: 1}} 
              value={birthDay} 
              onChange={(e) => setBirthDay(e.target.value)}
              disabled={loading}
            >
                <option value="">日</option>
                {/* 年と月が選択されている場合にのみ日のオプションを生成 */}
                {(birthYear && birthMonth ? generateDays(birthYear, birthMonth) : generateDays("2000", "01"))
                 .map(d => <option key={d} value={d}>{parseInt(d)}日</option>)}
            </select>
        </div>


        {/* ⭐ 性別選択 */}
        <select 
          style={styles.input} 
          value={gender} 
          onChange={(e) => setGender(e.target.value)}
          disabled={loading}
        >
            <option value="">性別を選択</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>


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