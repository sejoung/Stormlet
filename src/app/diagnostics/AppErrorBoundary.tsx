import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { BoardStore } from '../../domain/store';
import { errorDetails, log } from '../../adapters/diagnostics/log';
import { RecoveryScreen } from '../../components/recovery/RecoveryScreen';
import { downloadBoard } from '../useBoardFiles';
import { diagnostics } from './diagnostics';

/** Lines of React's component stack kept; the innermost components locate the crash. */
const COMPONENT_FRAMES = 6;

interface Props {
  store: BoardStore;
  locale: string;
  children: ReactNode;
}

/**
 * Catches a crash while rendering the board and shows the recovery screen instead of a
 * blank page. The store still holds every edit made before the crash, so the board can be
 * downloaded, and trying again remounts the board from it.
 */
export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    log.error('render.crashed', {
      ...errorDetails(error),
      components: info.componentStack?.trim().split('\n').slice(0, COMPONENT_FRAMES).join('\n'),
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { store, locale } = this.props;
    return (
      <RecoveryScreen
        {...diagnostics(locale, () => store.load())}
        onRetry={() => {
          log.info('render.retried');
          this.setState({ failed: false });
        }}
        onDownload={() => {
          try {
            downloadBoard(store.load());
          } catch (error) {
            log.error('recovery.download-failed', errorDetails(error));
          }
        }}
      />
    );
  }
}
