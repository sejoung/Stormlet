// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import type { Consent, UsageStats } from '../../../../src/adapters/analytics/google-analytics';
import { memoryStore, ids } from '../../../support/app';

/** Usage statistics that record the choices made. */
function fakeStats(consent: Consent | null = null) {
  const choices: Consent[] = [];
  const stats: UsageStats = {
    get consent() {
      return choices.at(-1) ?? consent;
    },
    choose: (next) => void choices.push(next),
  };
  return { stats, choices };
}

const banner = () => screen.queryByRole('region', { name: '사용 통계' });
const settingsItem = () => {
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  return within(screen.getByRole('menu', { name: '설정' })).queryByRole('menuitemcheckbox', {
    name: '사용 통계 보내기',
  });
};

describe('usage statistics', () => {
  it('asks once, without blocking the board, and remembers the answer', () => {
    const { stats, choices } = fakeStats();
    render(<App store={memoryStore()} newId={ids()} usageStats={stats} />);
    expect(banner()).toHaveTextContent('포스트잇 내용과 보드 이름은 보내지 않습니다');
    expect(within(banner()!).getByRole('link', { name: '자세히 보기' })).toHaveAttribute(
      'href',
      'manual/index.html#privacy',
    );
    // The board stays usable while the question is open.
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeInTheDocument();
    fireEvent.click(within(banner()!).getByRole('button', { name: '허용' }));
    expect(choices).toEqual(['granted']);
    expect(banner()).not.toBeInTheDocument();
    expect(settingsItem()).toHaveAttribute('aria-checked', 'true');
  });

  it('can be declined from the banner and changed later in the settings', () => {
    const { stats, choices } = fakeStats();
    render(<App store={memoryStore()} newId={ids()} usageStats={stats} />);
    fireEvent.click(within(banner()!).getByRole('button', { name: '거부' }));
    expect(banner()).not.toBeInTheDocument();
    const item = settingsItem()!;
    expect(item).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(item);
    expect(choices).toEqual(['denied', 'granted']);
    const again = settingsItem()!;
    expect(again).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(again);
    expect(choices.at(-1)).toBe('denied');
  });

  it('does not ask again once decided', () => {
    render(<App store={memoryStore()} newId={ids()} usageStats={fakeStats('denied').stats} />);
    expect(banner()).not.toBeInTheDocument();
  });

  it('shows neither the question nor the setting in a build without statistics', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    expect(banner()).not.toBeInTheDocument();
    expect(settingsItem()).not.toBeInTheDocument();
  });
});
