// app/dashboard/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { 
  getSession, 
  clearSession,
  TEACHER_USER_ID 
} from "@/lib/auth"; 

// ★★★ グラフ表示のためのインポート ★★★
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// ChartJSのコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const styles: any = {
  container: {
    minHeight: "100vh",
    padding: 20,
    backgroundColor: "#f0f4f8",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    paddingBottom: 10,
    borderBottom: "2px solid #ccc",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e40af",
  },
  logoutButton: {
    padding: "8px 16px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold",
    transition: "background 0.2s",
  },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 8,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    marginBottom: 20,
  },
  profile: {
    fontSize: 16,
    lineHeight: 1.5,
  },
  loading: {
    textAlign: 'center',
    fontSize: 18,
    color: '#374151',
    marginTop: 50,
  }
};

// グラフのオプション定義
const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: true,
      text: '科目別成績スコア',
    },
  },
  scales: {
    y: {
        min: 0,
        max: 100,
    }
  }
};


export default function StudentDashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    
    if (!session || session.id === TEACHER_USER_ID) {
      // セッションがない、または先生のセッションの場合はログインページへリダイレクト
      router.replace("/");
      return;
    }

    const fetchStudentData = async (userId: string) => {
      try {
        // 1. プロフィールデータの取得
        const profileDocRef = doc(db, "user_profiles", userId);
        const profileSnap = await getDoc(profileDocRef);
        
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
        } else {
          console.error("User profile not found for ID:", userId);
          handleLogout();
          return;
        }

        // 2. 成績データの取得
        const gradesColRef = collection(db, "grades", userId, "data");
        // 最新のデータを取得するため、日付でソートしたりする必要があるが、ここでは簡略化のため全取得
        const gradesSnapshot = await getDocs(gradesColRef);
        
        const fetchedGrades = gradesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // 日付フィールドがTimestampである場合にDateオブジェクトに変換
          date: doc.data().date?.toDate ? doc.data().date.toDate() : null
        }));
        setGrades(fetchedGrades);

      } catch (error) {
        console.error("生徒データ取得エラー:", error);
        handleLogout();
        alert("データの読み込みに失敗しました。再度ログインしてください。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData(session.id);
  }, [router]);

  // ★★★ グラフ表示のためのデータ整形 ★★★
  const chartData = useMemo(() => {
    // 科目ごとに最新のスコアを抽出するロジック（簡略化のため、ここでは単純に存在する全てのスコアを抽出）
    const labels = grades
        .filter(g => g.subject && typeof g.score === 'number')
        .map(g => g.subject);
    
    const scores = grades
        .filter(g => g.subject && typeof g.score === 'number')
        .map(g => g.score);

    return {
      labels: labels,
      datasets: [
        {
          label: 'スコア (点)',
          data: scores,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [grades]);
  
  // ✅ ログアウト処理
  const handleLogout = () => {
    clearSession();
    router.replace("/");
  };

  if (isLoading) {
    return <div style={styles.loading}>生徒ダッシュボードを読み込み中...</div>;
  }
  
  if (!userProfile) {
    return null; 
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>ようこそ、{userProfile.name}さん！</h1>
        <button style={styles.logoutButton} onClick={handleLogout}>
          ログアウト
        </button>
      </header>

      <div style={styles.card}>
        <h2>プロフィール情報</h2>
        <div style={styles.profile}>
          <p><strong>ユーザーID:</strong> {getSession()?.id}</p>
          <p><strong>名前:</strong> {userProfile.name}</p>
          <p><strong>生年月日:</strong> {userProfile.birthDate}</p>
        </div>
      </div>
      
      {/* ★★★ グラフ表示エリア ★★★ */}
      <div style={styles.card}>
        <h2>成績グラフ</h2>
        {chartData.labels.length > 0 ? (
          <div style={{ height: '350px' }}>
            
            <Bar options={chartOptions} data={chartData} />
          </div>
        ) : (
          <p>表示できる成績データがありません。</p>
        )}
      </div>

      <div style={styles.card}>
        <h2>最近の成績 (詳細)</h2>
        {grades.length === 0 ? (
          <p>まだ成績データがありません。</p>
        ) : (
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {/* 日付が新しい順にソートして表示（日付フィールドが正しく設定されている前提） */}
            {grades
                .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
                .map((grade) => (
              <li key={grade.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                <p>
                  <strong>{grade.subject || '科目不明'}</strong>: {grade.score || 'スコア未登録'}点 
                  ({grade.date ? grade.date.toLocaleDateString() : '日付不明'})
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}