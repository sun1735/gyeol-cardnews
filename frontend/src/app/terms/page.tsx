import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '이용약관 · Note2Card',
  description: 'Note2Card 서비스 이용약관',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 prose prose-slate">
      <div className="mb-6">
        <Link href="/" className="text-sm text-teal-700 hover:underline">
          ← 홈으로
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-2">이용약관</h1>
      <p className="text-sm text-slate-500 mb-8">
        시행일: 2026-04-21 · 최종 개정: 2026-04-21
      </p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <div>
          <h2 className="text-xl font-bold mt-0">제1조 (목적)</h2>
          <p>
            본 약관은 Note2Card(이하 "서비스")가 제공하는 브랜드 지식노트 기반 카드뉴스 자동 생성·편집·내보내기 서비스의 이용 조건 및 절차, 이용자와 서비스 운영자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold">제2조 (정의)</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>"이용자"는 본 약관에 동의하고 서비스에 로그인한 자연인 또는 법인을 말합니다.</li>
            <li>"콘텐츠"는 이용자가 업로드하거나 서비스를 통해 생성한 텍스트·이미지·영상 등 일체의 자료를 말합니다.</li>
            <li>"AI 생성 결과물"은 Google Gemini 등 외부 AI 모델을 통해 생성된 텍스트·이미지를 말합니다.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">제3조 (약관의 효력 및 변경)</h2>
          <p>
            본 약관은 서비스 초기 화면 또는 별도 페이지를 통해 공지함으로써 효력이 발생합니다. 운영자는 관련 법령에 위배되지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 최소 7일 전 공지합니다. 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단할 수 있습니다.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold">제4조 (서비스 이용)</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>서비스 이용은 Google 계정을 통한 로그인을 전제로 합니다.</li>
            <li>이용자는 자신의 계정 정보를 타인에게 양도·대여할 수 없습니다.</li>
            <li>서비스 이용 중 알게 된 타인의 정보를 외부에 유출하거나 도용해서는 안 됩니다.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">제5조 (이용자의 의무)</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>이용자는 업로드하는 모든 이미지·문서에 대해 본인이 저작권을 보유하거나 정당한 사용 권한을 확보해야 합니다.</li>
            <li>타인의 초상권·저작권·상표권 등을 침해하는 콘텐츠 업로드 시 모든 법적 책임은 이용자에게 있습니다.</li>
            <li>
              다음 행위는 금지됩니다:
              <ul className="list-disc pl-6 mt-1">
                <li>음란·폭력·차별·혐오를 조장하는 콘텐츠 생성</li>
                <li>의학적 효능을 단정하거나 허위·과장 광고에 해당하는 문구 생성</li>
                <li>미성년자에게 부적절한 콘텐츠 생성</li>
                <li>서비스의 AI·Rate Limit 을 우회·악용하는 자동화 요청</li>
              </ul>
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">제6조 (콘텐츠의 권리)</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>
              이용자가 업로드한 원본 콘텐츠의 저작권은 이용자에게 귀속됩니다. 다만, 서비스 운영에 필요한 범위 내에서 저장·처리·표시할 수 있는 사용권을 운영자에게 부여합니다.
            </li>
            <li>
              AI 생성 결과물(텍스트·이미지)의 저작권은 각 AI 제공사의 이용약관에 따릅니다. Google Gemini 는 생성 결과물의 상업적 사용을 허용하지만, 최종 책임은 이용자에게 있습니다.
            </li>
            <li>
              운영자는 이용자 콘텐츠를 다른 이용자에게 공개하거나 제3자에게 제공하지 않습니다.
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">제7조 (서비스의 제공 및 변경)</h2>
          <p>
            운영자는 기술적 문제, 외부 API 장애, 정책 변경 등으로 서비스 일부 또는 전부를 일시 중단할 수 있으며, 사전 공지가 불가능한 경우 사후 공지할 수 있습니다. 서비스는 현 상태 그대로(AS-IS) 제공되며, 특정 목적에의 적합성을 보증하지 않습니다.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold">제8조 (책임의 제한)</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>AI 가 생성한 결과물의 정확성·적법성·상업적 적합성을 보증하지 않습니다. 실제 게시 전 이용자가 직접 검토·보정해야 합니다.</li>
            <li>이용자의 저작권 침해, 허위 광고, 명예훼손 등으로 인해 발생하는 법적 분쟁에 대해 운영자는 책임지지 않습니다.</li>
            <li>천재지변, 외부 API 장애, 전기통신사업자 문제 등 운영자의 과실이 없는 사유로 인한 손해에 대해 책임을 지지 않습니다.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold">제9조 (계정 및 데이터 삭제)</h2>
          <p>
            이용자는 언제든지 계정 삭제를 요청할 수 있으며, 요청 시 계정 및 연결된 브랜드·지식노트·이미지·아이디어가 영구 삭제됩니다. 법령에 따라 일정 기간 보관이 요구되는 감사 로그(IP·접근 기록)는 예외로 합니다.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold">제10조 (준거법 및 재판관할)</h2>
          <p>
            본 약관의 해석 및 분쟁 해결은 대한민국 법령을 따르며, 이용자와 운영자 사이 분쟁이 발생한 경우 민사소송법상 관할 법원을 제1심 법원으로 합니다.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold">제11조 (문의)</h2>
          <p>
            약관에 관한 문의는 서비스 운영자에게 문의해 주세요.{' '}
            <Link href="/privacy" className="text-teal-700 hover:underline">
              개인정보처리방침
            </Link>{' '}
            도 함께 확인하실 수 있습니다.
          </p>
        </div>
      </section>
    </main>
  )
}
