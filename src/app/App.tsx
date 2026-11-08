import { useState } from 'react';
import { I18nProvider } from '../components/common/i18n';
import { DamagedBoardDialog } from '../components/recovery/DamagedBoardDialog';
import { downloadText } from '../adapters/files/download';
import { useLanguage } from './settings/useLanguage';
import { AppErrorBoundary } from './diagnostics/AppErrorBoundary';
import { Workspace, type WorkspaceProps } from './Workspace';

/** File name for the original data of a save that could not be read. */
export const DAMAGED_FILE_NAME = 'stormlet-damaged-board.txt';

type Props = Omit<WorkspaceProps, 'language' | 'onLanguage'> & {
  /** The original data of a saved board that could not be read, if any. */
  damaged?: string | null;
};

/**
 * The board in the chosen language; everything below reads it through `useT`. A crash
 * while rendering shows the recovery screen, and a saved board that could not be read
 * (`damaged`, its original data) is offered for download before anything else happens.
 */
export function App({ damaged = null, ...props }: Props) {
  const language = useLanguage();
  const [unread, setUnread] = useState(damaged);
  return (
    <I18nProvider locale={language.locale}>
      <AppErrorBoundary store={props.store} locale={language.locale}>
        <Workspace {...props} language={language.preference} onLanguage={language.choose} />
      </AppErrorBoundary>
      {unread !== null && (
        <DamagedBoardDialog
          onDownload={() => {
            downloadText(DAMAGED_FILE_NAME, unread, 'text/plain');
            setUnread(null);
          }}
          onClose={() => setUnread(null)}
        />
      )}
    </I18nProvider>
  );
}
