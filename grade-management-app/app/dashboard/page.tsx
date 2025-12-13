"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Line } from "react-chartjs-2";

// Chart.jsのコンポーネントとプラグインを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartDataLabels
);

// 成績データの型定義
type Grade = {
  id: string;
  test: string;
  subject: string;
  term: string;
  score: number;
  createdAt?: any;
};

// 選択肢の定義
const TESTS = ["中間テスト", "期末テスト", "実力テスト", "チャレンジテスト"];
const SUBJECTS = ["数学", "英語", "国語", "理科", "社会"];
const TERMS = ["一学期", "二学期", "三学期"];

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); 
  const [grades, setGrades] = useState<Grade[]>([]);
  
  // 入力フォーム用ステート
  const [test, setTest] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [score, setScore] = useState<number | "">("");

  // 絞り込み用ステート
  const [filterSubject, setFilterSubject] = useState("すべて");
  const [filterTest, setFilterTest] = useState("すべて");
  const [filterTerm, setFilterTerm] = useState("すべて");

  const [showChart, setShowChart] = useState(false);

  const router = useRouter();

  // ✅ 認証監視: 未ログインの場合はルートページへリダイレクト
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/");
      } else {
        setUser(u);
        setLoading(false); // ユーザー確認完了
      }
    });
    return () => unsub();
  }, [router]);

  // ✅ 成績取得（時系列）: ユーザーUID確定後に実行 + ログアウトエラー対策
  useEffect(() => {
    if (!user) {
        return; // userがnullの場合は処理をスキップ
    }

    const ref = query(
      collection(db, "grades", user.uid, "data"), 
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(ref, (snap) => {
      const list: Grade[] = [];
      snap.forEach((d) =>
        list.push({ id: d.id, ...(d.data() as Omit<Grade, "id">) })
      );
      setGrades(list);
    }, 
    (error) => {
      // Missing or insufficient permissions. エラー対応
      console.error("Firestore Snapshot Error:", error);
      setGrades([]); 
    });

    // ⭐ ログアウト対策: ユーザー状態が変更されるときにリスナーを確実に停止
    return () => unsub();
  }, [user]);

  // ✅ 成績追加
  const addGrade = async () => {
    if (!test || !subject || !term || score === "") {
      alert("すべて入力してください");
      return;
    }

    if (Number(score) < 0 || Number(score) > 100) {
      alert("点数は0〜100の間で入力してください");
      return;
    }

    if (!user) return;

    try {
      await addDoc(collection(db, "grades", user.uid, "data"), {
        test,
        subject,
        term,
        score: Number(score),
        createdAt: new Date(),
      });

      // 入力リセット
      setTest("");
      setSubject("");
      setTerm("");
      setScore("");
    } catch (err) {
      console.error(err);
      alert("成績の追加に失敗しました。");
    }
  };

  // ✅ 削除（確認付き）
  const deleteGrade = async (id: string) => {
    if (!user) return;
    if (!window.confirm("本当に削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "grades", user.uid, "data", id));
    } catch (err) {
      console.error(err);
      alert("削除に失敗しました。");
    }
  };

  // ✅ ログアウト
  const logout = async () => {
    await signOut(auth);
  };

  // ✅ 絞り込み適用
  const filteredGrades = grades.filter((g) => {
    const subjectMatch =
      filterSubject === "すべて" || g.subject === filterSubject;
    const testMatch = filterTest === "すべて" || g.test === filterTest;
    const termMatch = filterTerm === "すべて" || g.term === filterTerm;
    return subjectMatch && testMatch && termMatch;
  });

  // ✅ 統計計算
  const total = filteredGrades.reduce((sum, g) => sum + g.score, 0);
  const average =
    filteredGrades.length === 0 ? 0 : total / filteredGrades.length;

  const max =
    filteredGrades.length === 0
      ? 0
      : Math.max(...filteredGrades.map((g) => g.score));

  const min =
    filteredGrades.length === 0
      ? 0
      : Math.min(...filteredGrades.map((g) => g.score));

  // ✅ グラフ用データ（絞り込み反映）
  const chartData = {
    labels: filteredGrades.map(
      (g, i) => `${g.term} ${g.test}`
    ),
    datasets: [
      {
        label: "点数推移",
        data: filteredGrades.map((g) => g.score),
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79,70,229,0.2)",
        tension: 0.3,
        pointRadius: 6,
      },
    ],
  };

  // ✅ グラフオプション
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false, 
    plugins: {
      legend: { display: true },
      datalabels: {
        anchor: "end",
        align: "top",
        color: "#111",
        font: {
          weight: "bold",
          size: 12,
        },
        formatter: (value: number) => `${value}点`,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

  // ✅ ローディング中は画面を表示しない
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>読み込み中...</p>
      </div>
    );
  }

  // UIレンダリング
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>成績管理ダッシュボード</h1>
        <button style={styles.logoutButton} onClick={logout}>
          ログアウト
        </button>
      </div>

      {/* 成績追加 */}
      <div style={styles.card}>
        <h2>成績追加</h2>
        <div style={styles.formRow}>
          <select style={styles.selectInput} value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">学期</option>
            {TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>

          <select style={styles.selectInput} value={test} onChange={(e) => setTest(e.target.value)}>
            <option value="">テスト</option>
            {TESTS.map((t) => <option key={t}>{t}</option>)}
          </select>

          <select style={styles.selectInput} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">教科</option>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>

          <input
            type="number"
            style={styles.input}
            placeholder="点数 (0-100)"
            value={score}
            min={0}
            max={100}
            onChange={(e) =>
              setScore(e.target.value === "" ? "" : Number(e.target.value))
            }
          />

          <button style={styles.button} onClick={addGrade}>
            追加
          </button>
        </div>
      </div>

      {/* 絞り込み */}
      <div style={styles.filterBox}>
        <select style={styles.select} value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}>
          <option>すべて</option>
          {TERMS.map((t) => <option key={t}>{t}</option>)}
        </select>

        <select style={styles.select} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option>すべて</option>
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select style={styles.select} value={filterTest} onChange={(e) => setFilterTest(e.target.value)}>
          <option>すべて</option>
          {TESTS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* 統計 */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>平均：{average.toFixed(1)} 点</div>
        <div style={styles.statCard}>最高：{max} 点</div>
        <div style={styles.statCard}>最低：{min} 点</div>
      </div>

      {/* 分析ボタン */}
      <button style={styles.analysisButton} onClick={() => setShowChart(!showChart)}>
        {showChart ? "📉 グラフを閉じる" : "📈 グラフで分析する"}
      </button>

      {showChart && (
        <div style={styles.chartCard}>
          <div style={{ height: "300px" }}> 
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* 一覧 */}
      <div style={styles.list}>
        {filteredGrades.length === 0 ? (
          <p style={styles.noData}>データがありません</p>
        ) : (
          filteredGrades.map((g) => (
            <div style={styles.listItem} key={g.id}>
              <div>
                {g.term} / {g.test} / {g.subject} / {g.score} 点
              </div>
              <button style={styles.deleteButton} onClick={() => deleteGrade(g.id)}>
                削除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ✅ スタイル定義 (省略せず再掲)
const styles: any = {
  container: {
    minHeight: "100vh",
    padding: 30,
    background: "#f3f4f6",
  },
  loadingContainer: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#666",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid #ccc",
    borderTop: "4px solid #4f46e5",
    borderRadius: "50%",
    marginBottom: 10,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logoutButton: {
    background: "#374151",
    color: "white",
    borderRadius: 8,
    padding: "8px 16px",
    border: "none",
    cursor: "pointer",
  },
  card: { background: "white", padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" },
  formRow: {
    display: "flex",
    flexWrap: "wrap", 
    gap: 10,
  },
  input: { 
    padding: 10, 
    borderRadius: 8,
    border: "1px solid #d1d5db",
    flex: "1 1 80px",
  },
  selectInput: { 
    padding: 10, 
    borderRadius: 8,
    border: "1px solid #d1d5db",
    flex: "1 1 120px", 
  },
  button: { 
    padding: "10px 18px", 
    background: "#4f46e5", 
    color: "white",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
    flex: "1 1 100%", 
  },
  filterBox: { 
    display: "flex", 
    gap: 10, 
    marginBottom: 20,
    flexWrap: "wrap",
  },
  select: { padding: 8, borderRadius: 8, border: "1px solid #d1d5db" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  statCard: {
    background: "white",
    padding: 15,
    borderRadius: 12,
    textAlign: "center",
    fontWeight: "bold",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  analysisButton: {
    width: "100%",
    margin: "20px 0",
    padding: "12px 20px",
    borderRadius: 12,
    background: "#6366f1",
    color: "white",
    border: "none",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  },
  chartCard: {
    background: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  },
  list: { background: "white", borderRadius: 12, padding: 10, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottom: "1px solid #eee",
  },
  deleteButton: {
    background: "#fee2e2",
    color: "#ef4444",
    borderRadius: 8,
    padding: "6px 12px",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
  },
  noData: {
    textAlign: "center",
    padding: 20,
    color: "#9ca3af",
  }
};