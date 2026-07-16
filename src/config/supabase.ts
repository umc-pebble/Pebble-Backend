import { createClient } from '@supabase/supabase-js';

// 서버에서 Storage에 직접 쓰기(upload)를 수행하므로 service_role 키를 사용한다.
// (버킷에 별도 RLS 정책이 없어 anon 키로는 업로드가 거부된다. service_role 키는
//  RLS를 우회하는 만큼 클라이언트에는 절대 노출하지 말고 서버 환경변수로만 보관한다.)
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

export const UPLOAD_BUCKET = 'uploads';

export default supabase;
