import { Modal } from './Modal';

const SHORTCUTS = [
  ['보드 이름 수정', '제목 더블클릭 / Enter / F2'],
  ['포스트잇 도구', 'N'],
  ['선택 / 손 도구', 'V / H'],
  ['보드 이동', 'Space + 드래그'],
  ['메모 편집', '선택 후 입력 / Enter / 더블클릭'],
  ['줄바꿈 / 편집 완료', 'Shift + Enter / Enter'],
  ['편집 종료 / 선택 해제', 'Esc'],
  ['복제', '⌘ / Ctrl + D'],
  ['끌어서 복제', 'Option / Alt + 드래그'],
  ['방향에 맞춰 복제', 'Option / Alt + 방향키'],
  ['복사 / 붙여넣기', '⌘ / Ctrl + C / V'],
  ['전체 선택', '⌘ / Ctrl + A'],
  ['그룹 / 그룹 해제', '⌘ / Ctrl + G / Shift + G'],
  ['잠금 전환', '⌘ / Ctrl + Shift + L'],
  ['굵게 / 기울임 / 밑줄', '⌘ / Ctrl + B / I / U'],
  ['위치 조절', '방향키 · Shift로 10px씩'],
  ['실행 취소 / 다시 실행', '⌘ / Ctrl + Z / Shift + Z'],
  ['모든 메모 보기 / 선택한 메모 보기', 'Option / Alt + 1 / 2'],
  ['메모 검색', '⌘ / Ctrl + F'],
];

export function HelpDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal title="생각을 놓치지 않는 단축키" onClose={onClose}>
      <p className="modal-description">
        메모는 클릭해서 선택하고 바로 입력하세요. 엑셀의 셀이나 여러 줄의 텍스트도 보드에 붙여넣을
        수 있어요.
      </p>
      <dl className="shortcut-list">
        {SHORTCUTS.map(([action, key]) => (
          <div key={action}>
            <dt>{action}</dt>
            <dd>
              <kbd>{key}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
