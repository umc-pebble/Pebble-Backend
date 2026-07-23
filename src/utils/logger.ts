// 최소 logger 유틸. 서비스 계층에서 예상 밖 오류를 기록할 때 console.* 직접 호출 대신 사용한다
// (서버 기동 로그·최상위 에러 핸들러의 로그만 console 직접 사용이 허용된다).
export const logger = {
  error(...args: unknown[]) {
    console.error(...args);
  },
};
