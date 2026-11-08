import type { Board } from '../../domain/model';
import { writeClipboardText } from '../../adapters/browser/clipboard';
import { diagnosticsReport } from '../../adapters/diagnostics/report';
import { errorDetails, log } from '../../adapters/diagnostics/log';

/** What the diagnostics UI needs: a report built on demand and a way to copy it. */
export interface Diagnostics {
  report(): string;
  copy(text: string): Promise<void>;
}

/** Diagnostics for the board `load` returns, in the interface language `locale`. */
export function diagnostics(locale: string, load: () => Board): Diagnostics {
  return {
    report: () => {
      let board: Board;
      try {
        board = load();
      } catch (error) {
        // The report must still come out when the board itself is what broke.
        log.error('diagnostics.board-unavailable', errorDetails(error));
        board = { stickies: {} };
      }
      return diagnosticsReport({ locale, board });
    },
    copy: async (text) => {
      try {
        await writeClipboardText(text);
      } catch (error) {
        log.warn('diagnostics.copy-failed', errorDetails(error, false));
        throw error;
      }
    },
  };
}
