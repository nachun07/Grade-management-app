"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase"; 

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

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // ⭐ 生年月日を3つのステートに分割
  const [birthYear, setBirthYear] = useState("");  
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [gender, setGender] = useState("");     
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // ✅ ユーザー名＋追加情報＋パスワードでログイン
  const login = async () => {
    // ⭐ バリデーションチェックを3つのステートに合わせる
    if (!username || !password || !birthYear || !birthMonth || !birthDay || !gender) {
      alert("すべての情報を入力してください");
      return;
    }

    setIsLoading(true);
    let success = false;
    
    // ⭐ Firestoreの検索キーに合わせるために結合
    const birthdayString = `${birthYear}-${birthMonth}-${birthDay}`;

    try {
        // ⭐ 1. Firestoreで、ユーザー名、生年月日、性別のすべてに一致するアカウントを検索
        const q = query(
            collection(db, "user_profiles"), 
            where("name", "==", username),
            where("birthday", "==", birthdayString), 
            where("gender", "==", gender)      
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("入力情報に一致するアカウントが見つかりませんでした");
            setIsLoading(false);
            return;
        }

        // 2. 認証試行: 検索結果の全候補に対して総当たり認証を試行
        for (const userDoc of querySnapshot.docs) {
            const userData = userDoc.data();
            const internalEmail = userData.email;
            
            try {
                // Firebase Authによる認証試行
                await signInWithEmailAndPassword(auth, internalEmail, password);
                success = true;
                break; // 成功したら確定
            } catch (err: any) {
                // パスワード不一致 (auth/invalid-credential) の場合は、次の候補を試す
                if (err.code !== "auth/invalid-credential") {
                    console.error("Firebase Auth Error:", err);
                    throw err; 
                }
            }
        }

        if (success) {
            router.push("/dashboard");
        } else {
            alert("パスワードが間違っています");
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
        
        {/* ⭐ 生年月日選択フォーム */}
        <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
            {/* 年 */}
            <select 
              style={{...styles.input, flex: 1}} 
              value={birthYear} 
              onChange={(e) => setBirthYear(e.target.value)}
              disabled={isLoading}
            >
                <option value="">年</option>
                {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            
            {/* 月 */}
            <select 
              style={{...styles.input, flex: 1}} 
              value={birthMonth} 
              onChange={(e) => setBirthMonth(e.target.value)}
              disabled={isLoading}
            >
                <option value="">月</option>
                {MONTHS.map(m => <option key={m} value={m}>{parseInt(m)}月</option>)}
            </select>

            {/* 日 (年と月が選択されている場合にのみ正しく生成) */}
            <select 
              style={{...styles.input, flex: 1}} 
              value={birthDay} 
              onChange={(e) => setBirthDay(e.target.value)}
              disabled={isLoading}
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
          disabled={isLoading}
        >
            <option value="">性別を選択</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>


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