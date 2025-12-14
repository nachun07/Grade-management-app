// lib/auth.ts

// パスコードをハッシュ化する関数
// 現在の Firestore ルールに合わせて、パスコードをそのまま返します。
// 警告: 本番環境ではより強力なハッシュ化が必要です。
export const hashPasscode = (passcode: string): string => {
    return passcode; 
};

// 先生の固定認証情報 (firestore.rules と同じ値)
export const TEACHER_USER_ID = "teacher_admin";
export const TEACHER_PASSWORD_CODE = "123456"; 

// ★ ブラウザのLocalStorageにセッションを保存
export const setSession = (id: string, code: string) => {
    const hashedCode = hashPasscode(code);
    // LocalStorageにIDとハッシュ化されたコードを保存
    localStorage.setItem('custom_auth_id', id);
    localStorage.setItem('custom_auth_code', hashedCode);
};

// ★ セッション情報を取得
export const getSession = (): { id: string; code: string } | null => {
    if (typeof window === 'undefined') return null; // サーバーサイドでは動作させない
    
    const id = localStorage.getItem('custom_auth_id');
    const code = localStorage.getItem('custom_auth_code'); // これはハッシュ化されたコード
    return id && code ? { id, code } : null;
};

// ★ セッションをクリア（ログアウト）
export const clearSession = () => {
    localStorage.removeItem('custom_auth_id');
    localStorage.removeItem('custom_auth_code');
};