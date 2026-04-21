import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침 · Note2Card',
  description: 'Note2Card 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 prose prose-slate">
      <div className="mb-6">
        <Link href="/" className="text-sm text-teal-700 hover:underline">
          ← 홈으로
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-2">개인정보처리방침</h1>
      <p className="text-sm text-slate-500 mb-8">
        시행일: 2026-04-21 · 최종 개정: 2026-04-21
      </p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <div>
          <p className="m-0">
            Note2Card(이하 "서비스")는 「개인정보 보호법」 제30조에 따라 이용자의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위해 다음과 같이 처리방침을 수립·공개합니다.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mt-0">1. 수집하는 개인정보 항목</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y">
                <th className="text-left py-2 px-3 font-semibold">구분</th>
                <th className="text-left py-2 px-3 font-semibold">항목</th>
                <th className="text-left py-2 px-3 font-semibold">수집 시점</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b">
                <td className="py-2 px-3">필수</td>
                <td className="py-2 px-3">Google 계정 이메일, 이름, 프로필 이미지 URL</td>
                <td className="py-2 px-3">최초 로그인 시</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">자동 수집</td>
                <td className="py-2 px-3">IP 주소, 접속 일시, 브라우저 정보, 서비스 이용 기록</td>
                <td className="py-2 px-3">서비스 이용 시</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">이용자 입력</td>
                <td className="py-2 px-3">브랜드 정보, 지식노트 문서, 업로드 이미지, AI 생성 프롬프트</td>
                <td className="py-2 px-3">기능 사용 시</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-xl font-bold">2. 개인정보의 이용 목적</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>회원 인증 및 계정 관리</li>
            <li>카드뉴스 생성·편집·내보내기 기능 제공</li>
            <li>AI 이미지·텍스트 생성 기능을 위한 외부 API(Google Gemini) 요청 대리 전송</li>
            <li>서비스 이용 이력에 기반한 품질 개선 및 장애 대응</li>
            <li>법령 및 약관 위반 행위에 대한 제재·신고</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">3. 개인정보의 보유 및 이용 기간</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>
              <strong>계정 정보</strong>: 회원 탈퇴 시 즉시 파기
            </li>
            <li>
              <strong>이용자 콘텐츠</strong>(브랜드·지식노트·이미지·아이디어): 회원 탈퇴 또는 이용자 직접 삭제 시 즉시 파기
            </li>
            <li>
              <strong>감사 로그</strong>(프롬프트 해시·미리보기 80자·outcome·IP): 90일 보관 후 자동 삭제
            </li>
            <li>
              <strong>법령상 보존 의무 정보</strong>: 통신비밀보호법·전자상거래법에 따른 접속기록 3개월, 거래 기록 5년 등
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">4. 개인정보의 제3자 제공 및 위탁</h2>
          <p>운영자는 법령에 의하지 않고는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 서비스 제공을 위해 아래와 같이 일부 업무를 위탁하고 있습니다:</p>
          <table className="w-full text-sm border-collapse mt-2">
            <thead>
              <tr className="bg-slate-50 border-y">
                <th className="text-left py-2 px-3 font-semibold">수탁자</th>
                <th className="text-left py-2 px-3 font-semibold">위탁 업무</th>
                <th className="text-left py-2 px-3 font-semibold">전송 데이터</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b">
                <td className="py-2 px-3">Google LLC</td>
                <td className="py-2 px-3">OAuth 인증 · Gemini API 텍스트·이미지 생성</td>
                <td className="py-2 px-3">
                  인증: 이메일·프로필<br />
                  생성: 프롬프트 텍스트·업로드 이미지(일회성 전송, Google 은 저장하지 않음)
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">Railway Corp.</td>
                <td className="py-2 px-3">서버·DB·파일 저장 호스팅</td>
                <td className="py-2 px-3">전체 이용자 데이터 (암호화 전송·저장)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-xl font-bold">5. 이용자의 권리</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.</li>
            <li>브랜드 관리 모달의 "🗑️ 브랜드 영구 삭제" 또는 계정 삭제 기능으로 직접 삭제할 수 있습니다.</li>
            <li>삭제 요청 후 14세 미만 아동의 보호자 확인 또는 법령상 보존 의무가 있는 정보는 제외하고 지체 없이 파기됩니다.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">6. 개인정보 안전성 확보 조치</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>HTTPS(TLS) 를 통한 전 구간 암호화 전송</li>
            <li>개인정보 최소 수집 원칙 (이메일·이름·프로필 이미지 URL 만 수집)</li>
            <li>프롬프트 원문 저장 금지 — SHA-256 앞 16자 해시 + 미리보기 80자로만 로그</li>
            <li>IP 기반 Rate Limit 으로 비정상 접근 차단</li>
            <li>감사 로그 90일 자동 삭제</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">7. 만 14세 미만 아동의 개인정보</h2>
          <p>
            본 서비스는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 보호자 동의 없이 만 14세 미만 아동이 가입한 사실이 확인되면 해당 계정을 즉시 삭제합니다.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold">8. 개인정보 보호책임자</h2>
          <p>
            서비스 개인정보 보호책임자는 서비스 운영자입니다. 개인정보 관련 문의 및 불만은{' '}
            <Link href="/terms" className="text-teal-700 hover:underline">
              이용약관
            </Link>{' '}
            에 명시된 방법으로 접수해 주세요.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold">9. 변경 이력</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>2026-04-21: 최초 제정 (서비스 런칭)</li>
          </ul>
        </div>
      </section>
    </main>
  )
}
