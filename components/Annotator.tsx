"use client";

import { useCallback } from 'react';
import { useAnnotationSession } from '../core/annotation/session/useAnnotationSession';
import { AnnotationContext } from '../contexts/Annotator.context';
import {
  AnnotatorOverlayProvider,
  useAnnotatorOverlay,
} from '../contexts/AnnotatorOverlay.context';
import {
  ContextualLayer,
  DialogLayer,
  FeedbackLayer,
  OverlayFocusScope,
  OverlayRoot,
  WorkspaceLayer,
} from './overlay';
import { Button } from './design-system/button';
import AnnotationsPanel from './AnnotationsPanel';
import SelectionToolbar from './SelectionToolbar';
import FocusedAnnotationToolbar from './FocusedAnnotationToolbar';
import ActionDialog from './ActionDialog';
import PasteHtmlDialog from './PasteHtmlDialog';
import Loader from './Loader';
import annotationStyles from './styles/Annotator.styles';

export type AnnotatorProps = {
  pageId: string;
  pageUrl: string;
  iframeUrl: string;
  frameSiteId: string;
  frameStoragePath: string;
  initialAnnotations?: Annotation[];
  initialTitle?: string;
};

export default function Annotator(props: AnnotatorProps) {
  return (
    <AnnotatorOverlayProvider>
      <AnnotatorWorkspace {...props} />
    </AnnotatorOverlayProvider>
  );
}

function AnnotatorWorkspace(props: AnnotatorProps) {
  const {
    pageId,
    pageUrl,
    iframeUrl,
    frameSiteId,
    frameStoragePath,
    initialAnnotations,
    initialTitle,
  } = props;
  const overlay = useAnnotatorOverlay();
  const session = useAnnotationSession({
    pageId,
    pageUrl,
    iframeUrl,
    initialTitle,
    onExternalHref: overlay.showExternalLink,
  });
  const {
    attachFrame,
    ready,
    error,
    title,
    frameSourceUrl,
    reportFrameError,
    reloadFrame,
    openInAnnotator: openHrefInAnnotator,
    openOriginal: openHrefOriginal,
  } = session;
  const pendingHref = overlay.dialog.type === 'externalLink' ? overlay.dialog.href : null;
  const showPasteHtml = overlay.dialog.type === 'pasteHtml';

  const openInAnnotator = useCallback(async (href: string) => {
    await openHrefInAnnotator(href);
    overlay.closeDialog();
  }, [openHrefInAnnotator, overlay]);

  const openOriginal = useCallback((href: string) => {
    openHrefOriginal(href);
    overlay.closeDialog();
  }, [openHrefOriginal, overlay]);

  const openPasteHtml = useCallback(() => {
    overlay.showPasteHtml(error || undefined);
  }, [error, overlay]);

  return (
    <>
      <iframe
        ref={attachFrame}
        id="annotated-frame"
        title={title || 'Page being annotated'}
        src={frameSourceUrl}
        sandbox="allow-scripts allow-same-origin allow-forms"
        onError={() => {
          const message = 'The proxied page could not be loaded.';
          reportFrameError(message);
          overlay.showPasteHtml(message);
        }}
        style={{ width: '100%', height: '100dvh', border: 'none', display: 'block' }}
      />

      <AnnotationContext
        initialAnnotations={initialAnnotations}
        pageId={pageId}
        pageUrl={pageUrl}
        session={session}
      >
        <OverlayRoot>
          <WorkspaceLayer>
            <AnnotationsPanel
              open={overlay.panel.type === 'annotations'}
              onOpenChange={(open) => {
                if (open) overlay.openAnnotations();
                else overlay.closePanel();
              }}
              onPasteHtml={openPasteHtml}
            />
          </WorkspaceLayer>

          <ContextualLayer>
            <SelectionToolbar />
            <FocusedAnnotationToolbar />
          </ContextualLayer>

          <FeedbackLayer>
            {!ready && <Loader />}
            {error && !showPasteHtml && (
              <div role="alert" style={annotationStyles.errorToast}>
                <span style={annotationStyles.errorCopy}>
                  <strong style={annotationStyles.errorTitle}>Page unavailable</strong>
                  <span style={annotationStyles.errorDescription}>Load a saved copy of the page source to continue.</span>
                </span>
                <Button variant="secondary" size="small" onClick={openPasteHtml}>Paste HTML</Button>
              </div>
            )}
          </FeedbackLayer>

          <DialogLayer>
            {pendingHref && (
              <OverlayFocusScope>
                <ActionDialog
                  message={(
                    <>
                      <div style={annotationStyles.promptTitle}>Where should this link open?</div>
                      <div style={annotationStyles.promptDescription}>
                        Keep working inside the annotation workspace, or open the original page in a new tab.
                      </div>
                      <em style={annotationStyles.externalUrl}>{pendingHref}</em>
                    </>
                  )}
                  actions={[
                    { label: 'Open in Annotator', action: () => void openInAnnotator(pendingHref), variant: 'primary' },
                    { label: 'Open original', action: () => openOriginal(pendingHref), variant: 'secondary' },
                    { label: 'Cancel', action: overlay.closeDialog, variant: 'neutral' },
                  ]}
                  onClose={overlay.closeDialog}
                />
              </OverlayFocusScope>
            )}

            {showPasteHtml && (
              <OverlayFocusScope>
                <PasteHtmlDialog
                  error={overlay.dialog.type === 'pasteHtml' ? overlay.dialog.error : error}
                  siteId={frameSiteId}
                  path={frameStoragePath}
                  onSuccess={() => {
                    overlay.closeDialog();
                    void reloadFrame();
                  }}
                  onClose={overlay.closeDialog}
                />
              </OverlayFocusScope>
            )}
          </DialogLayer>
        </OverlayRoot>
      </AnnotationContext>
    </>
  );
}

