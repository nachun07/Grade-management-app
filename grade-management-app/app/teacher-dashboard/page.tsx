// app/teacher-dashboard/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  orderBy,
  query,
  QueryDocumentSnapshot,
  getDocs,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

// Chart.js関連のインポート
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
  Title, 
  TooltipItem,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title, 
  ChartDataLabels
);

// 型定義
type Grade = {
  id: string;
  test: string;
  subject: string;
  term: string;
  score: number;
  createdAt: any; 
  studentName?: string; // ★ 全体表示モードでの識別用に追加
};

// 生徒データの型定義
type StudentSummary = {
    uid: string;
    email: string;
    name: string; // ユーザー名
    gradeCount: number; 
    latestScore: number | null; 
};

// 選択肢の定義
const TESTS = ["中間テスト", "期末テスト", "実力テスト", "チャレンジテスト"];
const SUBJECTS = ["数学", "英語", "国語", "理科", "社会"];
const TERMS = ["一学期", "二学期", "三学期"];

type LineChartData = ChartData<'line'>;

// ⭐ 先生の内部メールアドレス
const TEACHER_EMAIL = "teacher@example.com"; 

// ⭐⭐⭐ グラフ用データ集計関数 ⭐⭐⭐
const prepareChartData = (
  grades: Grade[], 
  filterTerm: string, 
  filterSubject: string, 
  filterTest: string
): LineChartData => {
  
  const filteredGrades = grades.filter(g => {
    const termMatch = filterTerm === "すべて" || g.term === filterTerm;
    const subjectMatch = filterSubject === "すべて" || g.subject === filterSubject;
    const testMatch = filterTest === "すべて" || g.test === filterTest;
    return termMatch && subjectMatch && testMatch;
  }).sort((a, b) => {
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeA - timeB;
  });

  const uniqueTestLabels = Array.from(new Set(
      filteredGrades.map(g => g.test)
  ));

  const dataBySubject: { 
    [subject: string]: { 
      [label: string]: number; 
    } 
  } = {};

  filteredGrades.forEach(grade => {
    const label = grade.test; 
    if (!dataBySubject[grade.subject]) {
      dataBySubject[grade.subject] = {};
    }
    // 全体表示モードでは、同じラベルに複数の点数が入る可能性があるため、平均を使用するなど工夫が必要ですが、
    // ここでは単純に上書きするか、最初の点数を使用する形にします。
    if (dataBySubject[grade.subject][label] === undefined) {
      dataBySubject[grade.subject][label] = grade.score;
    }
  });

  const subjectsToDisplay = Object.keys(dataBySubject);

  const datasets = subjectsToDisplay.map((subject, index) => {
    const color = [
      '#ef4444', 
      '#3b82f6', 
      '#10b981', 
      '#f59e0b', 
      '#6366f1', 
      '#f43f5e', 
    ][index % 6];

    const scores = uniqueTestLabels.map(label => dataBySubject[subject][label] ?? null);

    return {
      label: subject,
      data: scores, 
      borderColor: color,
      backgroundColor: color + '30', 
      fill: false, 
      tension: 0.2, 
      pointRadius: 5,
      hidden: false, 
    };
  });

  return { labels: uniqueTestLabels, datasets };
};

// ⭐⭐⭐ スタイル定義 ⭐⭐⭐
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
  teacherButton: { 
    padding: "6px 12px", 
    background: "#3b82f6", 
    color: "white",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
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
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    marginBottom: 15,
    boxSizing: "border-box",
  }
};


export default function TeacherDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); 
  const [grades, setGrades] = useState<Grade[]>([]);
  
  const [isTeacher, setIsTeacher] = useState(false);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null); 
  
  // ★★★ 追加ステート ★★★
  const [isViewingAll, setIsViewingAll] = useState(false); // 全員表示モードのフラグ
  const [searchTerm, setSearchTerm] = useState("");      // 生徒リスト検索キーワード
  // ★★★ ここまで ★★★
  
  const [chartData, setChartData] = useState<LineChartData>({
      labels: [], 
      datasets: []
  });
  
  const [filterSubject, setFilterSubject] = useState("すべて");
  const [filterTest, setFilterTest] = useState("すべて");
  const [filterTerm, setFilterTerm] = useState("すべて");
  const [showChart, setShowChart] = useState(false);

  const router = useRouter();

  // ✅ 認証監視: 先生アカウントでなければ強制ログアウトまたはリダイレクト
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/teacher-admin"); 
      } else {
        const isTeacherAccount = u.email === TEACHER_EMAIL;
        
        if (!isTeacherAccount) {
            signOut(auth).then(() => router.push("/"));
            return;
        }

        setUser(u);
        setIsTeacher(true); 
        setLoading(false); 
      }
    });
    return () => unsub();
  }, [router]);


  // ★ 先生用: 全生徒の UID とユーザープロファイルをリアルタイムで取得する useEffect
  useEffect(() => {
    if (!user) return; 

    const userProfilesRef = collection(db, "user_profiles");
    const profilesQuery = query(userProfilesRef);

    const unsub = onSnapshot(profilesQuery, async (snapshot) => {
      const studentPromises: Promise<StudentSummary>[] = [];

      snapshot.forEach((doc) => {
        const profile = doc.data();
        const studentUid = doc.id; 

        const studentPromise = (async (): Promise<StudentSummary> => {
            let gradeCount = 0;
            let latestScore = null;
            
            try {
                const gradesRef = collection(db, "grades", studentUid, "data");
                const gradesSnapshot = await getDocs(query(gradesRef, orderBy("createdAt", "desc"), limit(1)));
                
                gradeCount = gradesSnapshot.docs.length; 
                
                if (!gradesSnapshot.empty) {
                    const latestGrade = gradesSnapshot.docs[0].data();
                    latestScore = latestGrade.score ?? null;
                }
                
            } catch (e) {
                console.error(`Failed to fetch initial grade info for ${studentUid}`, e);
            }
            
            return {
                uid: studentUid,
                email: profile.email || 'N/A',
                name: profile.name || '名前なし', 
                gradeCount: gradeCount,
                latestScore: latestScore,
            };
        })();
        
        studentPromises.push(studentPromise);
      });
      
      const allStudents = await Promise.all(studentPromises);
      setStudents(allStudents);
    });
    
    return () => unsub();
    
  }, [user]);

  // ★★★ 追加: 全員モード時の全成績取得ロジック ★★★
  useEffect(() => {
      // 先生が全員表示モードではない場合、または生徒リストが空の場合はスキップ
      if (!user || !isViewingAll || students.length === 0) return; 
      
      // 個別表示モードの成績データをクリア
      setCurrentStudentId(null);
      
      const allGradesPromises: Promise<Grade[]>[] = students.map(s => {
          return (async () => {
              const gradesRef = collection(db, "grades", s.uid, "data");
              // 全件取得し、どの生徒の成績かわかるようにUIDと名前を付与
              const gradesSnapshot = await getDocs(query(gradesRef, orderBy("createdAt", "asc")));
              
              const gradesList: Grade[] = [];
              gradesSnapshot.forEach((d: QueryDocumentSnapshot) => {
                  gradesList.push({ 
                      id: d.id, 
                      ...(d.data() as Omit<Grade, "id">),
                      studentName: s.name // ★ 成績に生徒名を紐づけ
                  } as Grade);
              });
              return gradesList;
          })();
      });
      
      Promise.all(allGradesPromises).then(results => {
          // 全生徒の成績リストを結合し、日付順にソート
          const combinedGrades = results.flat().sort((a, b) => {
              const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
              const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
              return timeA - timeB;
          });
          setGrades(combinedGrades);
      }).catch(e => {
          console.error("Failed to fetch all students' grades:", e);
          setGrades([]);
      });
      
  }, [user, isViewingAll, students.length]); 

  // ✅ 成績取得: 選択された生徒のUIDが変わるたびに実行 (個別モードのみ動作)
  useEffect(() => {
    const targetUid = currentStudentId;

    if (!targetUid || isViewingAll) { // ★ 全体表示中はスキップ
        setGrades([]);
        return; 
    }

    const ref = query(
      collection(db, "grades", targetUid, "data"), 
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(ref, (snap) => {
      const list: Grade[] = [];
      snap.forEach((d: QueryDocumentSnapshot) => {
        list.push({ id: d.id, ...(d.data() as Omit<Grade, "id">) });
      });
      setGrades(list);
    }, 
    (error: any) => { 
      console.error("Firestore Snapshot Error:", error);
      setGrades([]); 
    });

    return () => unsub();
  }, [currentStudentId, isViewingAll]); // isViewingAll に依存

  // ⭐ グラフデータの更新処理 (grades, filterStateに依存)
  useEffect(() => {
      const newChartData = prepareChartData(
          grades, 
          filterTerm, 
          filterSubject, 
          filterTest
      );
      setChartData(newChartData);
  }, [grades.length, filterTerm, filterSubject, filterTest]); 


  // ✅ 削除（先生用）
  const deleteGrade = async (id: string) => {
    if (!currentStudentId) return;
    
    if (!window.confirm(`この生徒の成績 (ID: ${id}) を本当に削除しますか？`)) return;

    try {
      await deleteDoc(doc(db, "grades", currentStudentId, "data", id));
    } catch (err) {
      console.error(err);
      alert("削除に失敗しました。");
    }
  };

  // ✅ ログアウト
  const logout = async () => {
    await signOut(auth);
    router.push("/teacher-admin"); 
  };
  
  // ★★★ useMemo: 検索フィルター付きの生徒リスト ★★★
  const filteredStudents = useMemo(() => {
    if (!searchTerm) {
      return students;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(lowerSearchTerm) || 
      s.email.toLowerCase().includes(lowerSearchTerm)
    );
  }, [students, searchTerm]);

  // ✅ 絞り込み適用 (リスト表示用)
  const filteredGrades = grades.filter((g) => {
    const subjectMatch = filterSubject === "すべて" || g.subject === filterSubject;
    const testMatch = filterTest === "すべて" || g.test === filterTest;
    const termMatch = filterTerm === "すべて" || g.term === filterTerm;
    return subjectMatch && testMatch && termMatch;
  });

  // ✅ 統計計算
  const total = filteredGrades.reduce((sum, g) => sum + g.score, 0);
  const average = filteredGrades.length === 0 ? 0 : total / filteredGrades.length;
  const max = filteredGrades.length === 0 ? 0 : Math.max(...filteredGrades.map((g) => g.score));
  const min = filteredGrades.length === 0 ? 0 : Math.min(...filteredGrades.map((g) => g.score));

  // ⭐⭐ グラフオプション 
  const chartOptions: ChartOptions<'line'> & { plugins: { datalabels: any } } = {
    responsive: true,
    maintainAspectRatio: false, 
    interaction: { mode: 'index', intersect: false },
    plugins: {
      title: { display: true, text: filterTerm === "すべて" ? '教科別成績推移' : `${filterTerm} 教科別成績推移`, font: { size: 16 } },
      legend: { display: true, position: 'top', labels: { usePointStyle: true } },
      tooltip: { callbacks: { label: (context: TooltipItem<'line'>) => { if (context.parsed.y === null) return undefined; return `${context.dataset.label}: ${context.parsed.y} 点`; } } },
      datalabels: { display: false },
    },
    scales: { x: { title: { display: true, text: 'テストの種類' }, grid: { display: false } }, y: { title: { display: true, text: '点数 (Score)' }, min: 0, max: 100, ticks: { stepSize: 10, callback: (value: any) => value + '点' } } },
  };

  // ----------------------------------------------------
  // ⭐ レンダーロジック
  // ----------------------------------------------------

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}} />
        <div style={{...styles.spinner, animation: 'spin 1s linear infinite'}}></div>
        <p>先生管理ボード読み込み中...</p>
      </div>
    );
  }
    
  // 先生が特定の生徒を選択しておらず、かつ全体表示モードでもない場合 -> 生徒リスト表示
  if (!currentStudentId && !isViewingAll) {
      return (
          <div style={styles.container}>
              <div style={styles.header}>
                  <h1>👨‍🏫 先生管理ボード (生徒一覧)</h1>
                  <button style={styles.logoutButton} onClick={logout}>
                      ログアウト
                  </button>
              </div>
              <div style={styles.card}>
                  
                  {/* ★★★ 検索機能の UI ★★★ */}
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="生徒名、メールアドレスで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  
                  <h2>生徒リスト ({filteredStudents.length}名)</h2>
                  
                  {filteredStudents.length === 0 ? (
                      <p style={styles.noData}>検索条件に一致する生徒データが見つかりません。</p>
                  ) : (
                      <div style={styles.list}>
                          {filteredStudents.map((s) => (
                              <div style={styles.listItem} key={s.uid}>
                                  <div>
                                      <strong>{s.name}</strong> ({s.email}) (成績件数: {s.gradeCount}, 最新点: {s.latestScore ?? 'N/A'})
                                  </div>
                                  <button 
                                      style={styles.teacherButton} 
                                      onClick={() => {
                                          setCurrentStudentId(s.uid); 
                                          setIsViewingAll(false); 
                                          setFilterSubject("すべて");
                                          setFilterTest("すべて");
                                          setFilterTerm("すべて");
                                          setShowChart(false);
                                      }}
                                  >
                                      成績を見る
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              
              {/* ★★★ 全体表示への遷移ボタン ★★★ */}
              <button 
                  style={{...styles.analysisButton, marginTop: 20}}
                  onClick={() => setIsViewingAll(true)}
              >
                  ➡️ 全生徒の成績を一括で分析・確認する
              </button>
          </div>
      );
  }
    
  // ★★★ 全体表示モードの場合のレンダリング ★★★
  if (isViewingAll) {
      return (
          <div style={styles.container}>
              <div style={styles.header}>
                  <h1>🌍 全生徒の成績分析</h1>
                  <div>
                      <button 
                          style={{...styles.teacherButton, marginRight: 10}}
                          onClick={() => {
                              setIsViewingAll(false); // 生徒一覧に戻る
                              setGrades([]); // 成績データをクリア
                          }}
                      >
                          ◀ 生徒一覧に戻る
                      </button>
                      <button style={styles.logoutButton} onClick={logout}>
                          ログアウト
                      </button>
                  </div>
              </div>

              {/* 絞り込み (全員分に適用) */}
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

              {/* 統計 (全員分) */}
              <div style={styles.statsGrid}>
                  <div style={styles.statCard}>平均：{average.toFixed(1)} 点</div>
                  <div style={styles.statCard}>最高：{max} 点</div>
                  <div style={styles.statCard}>最低：{min} 点</div>
              </div>

              {/* 分析ボタン (グラフ) */}
              <button style={styles.analysisButton} onClick={() => setShowChart(!showChart)}>
                  {showChart ? "📉 グラフを閉じる" : "📈 グラフで分析する"}
              </button>

              {showChart && (
                  <div style={styles.chartCard}>
                      <h2>{filterTerm === "すべて" ? '全期間' : filterTerm}の成績推移</h2>
                      <div style={{ height: "400px" }}> 
                          {chartData.labels!.length > 0 ? (
                              <Line data={chartData} options={chartOptions} />
                          ) : (
                              <p style={styles.noData}>グラフ表示に必要なデータがありません。</p>
                          )}
                      </div>
                  </div>
              )}

              {/* 全成績一覧 */}
              <div style={styles.card}>
                  <h2 style={{marginBottom: 10}}>全成績一覧 ({filteredGrades.length}件)</h2>
                  <div style={styles.list}>
                      {filteredGrades.length === 0 ? (
                          <p style={styles.noData}>表示する成績データがありません。</p>
                      ) : (
                          filteredGrades.map((g) => (
                              <div style={styles.listItem} key={g.id + g.studentName}>
                                  <div>
                                      <strong>{g.studentName}</strong>: {g.term} / {g.test} / {g.subject} / {g.score} 点
                                  </div>
                                  {/* 削除ボタンは個別表示モードのみ */}
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      );
  }
  
  // ★★★ 個別成績モードの場合のレンダリング (既存のロジック) ★★★
  const currentStudent = students.find(s => s.uid === currentStudentId);

  return (
      <div style={styles.container}>
          <div style={styles.header}>
              <h1>成績 ({currentStudent?.name ?? "詳細"})</h1>
              <div>
                  <button 
                      style={{...styles.teacherButton, marginRight: 10}}
                      onClick={() => setCurrentStudentId(null)}
                  >
                      ◀ 生徒一覧に戻る
                  </button>
                  <button style={styles.logoutButton} onClick={logout}>
                      ログアウト
                  </button>
              </div>
          </div>

          {/* 絞り込み (個別生徒に適用) */}
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
                  <h2>{filterTerm === "すべて" ? '全期間' : filterTerm}の成績推移</h2>
                  <div style={{ height: "400px" }}> 
                      {chartData.labels!.length > 0 ? (
                          <Line data={chartData} options={chartOptions} />
                      ) : (
                          <p style={styles.noData}>グラフ表示に必要なデータがありません。</p>
                      )}
                  </div>
              </div>
          )}

          {/* 一覧 */}
          <div style={styles.list}>
              {filteredGrades.length === 0 ? (
                  <p style={styles.noData}>この生徒にはまだ成績が登録されていません。</p>
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