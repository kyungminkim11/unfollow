(() => {
  'use strict';

  const replacements = new Map([
    ['자동 언팔 없음', '선택형 자동화 제공'],
    ['결과를 확인한 뒤 Instagram에서 직접 판단하고 처리합니다.', '대상 목록을 확인한 뒤 Companion에서 처리 수와 대기 시간을 정해 시작합니다.'],
    ['프로필로 이동만 도와주고, 실제 취소는 사용자가 직접 진행합니다.', '기본 검토 모드는 프로필 이동을 지원하고, 선택한 목록은 Companion에서 사용자가 시작한 배치 작업으로 처리할 수 있습니다.'],
    ['자동으로 언팔하나요?', '팔로우 취소 자동화는 어떻게 작동하나요?'],
    ['아닙니다. 맞팔체커는 관계를 분류하고 프로필 링크를 제공할 뿐입니다. 팔로우 변경은 사용자가 Instagram에서 직접 진행합니다.', '웹에서 목록을 계산한 뒤 Chrome Companion으로 전달합니다. 사용자가 처리 수·대기·휴식을 확인하고 시작해야 하며, 보안 확인이나 연속 오류가 감지되면 중지합니다.']
  ]);

  function rewrite() {
    document.querySelectorAll('body *').forEach(element => {
      if (element.children.length) return;
      const text = (element.textContent || '').trim();
      const next = replacements.get(text);
      if (next) element.textContent = next;
    });
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Instagram 데이터 ZIP으로 비맞팔과 팔로워 이탈을 분석하고, 선택한 목록을 Chrome Companion에서 안전장치가 적용된 배치 작업으로 처리하는 도구';
  }

  rewrite();
  let timer = 0;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(rewrite, 80);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();