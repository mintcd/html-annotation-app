"use client";

import { useCallback, type RefObject } from 'react';
import { useClickHref } from '../hooks/Annotator.hooks';
import { useAnnotatorController } from '../hooks/useAnnotatorController';
import { AnnotationContext } from '../context/Annotator.context';
import {
  AnnotatorOverlayProvider,
  useAnnotatorOverlay,
} from '../context/AnnotatorOverlay.context';
import {
  ContextualLayer,
  DialogLayer,
  FeedbackLayer,
  OverlayFocusScope,
  OverlayRoot,
  WorkspaceLayer,
} from './overlay';
import { Button } from '../design-system/button';
import Sidebar from './Sidebar';
import MenuOnRange from './MenuOnRange';
import MenuOnFocus from './MenuOnFocus';
import PromptBox from './PromptBox';
import PasteHTML from './PasteHTML';
import Loader from './Loader';
import ClientFrame from './ClientFrame';
import annotationStyles from '../styles/Annotator.styles';

export type AnnotatorProps = {
  pageId: string;
  pageUrl: string;
  iframeUrl: string;
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
  } = props;
  const controller = useAnnotatorController(props);
  const overlay = useAnnotatorOverlay();
  const pendingHref = overlay.dialog.type === 'externalLink' ? overlay.dialog.href : null;
  const showPasteHtml = overlay.dialog.type === 'pasteHtml';

  useClickHref(
    controller.iframeRef as RefObject<HTMLElement | null>,
    overlay.showExternalLink,
  );

  const openInAnnotator = useCallback(async (href: string) => {
    await controller.openInAnnotator(href);
    overlay.closeDialog();
  }, [controller, overlay]);

  const openOriginal = useCallback((href: string) => {
    controller.openOriginal(href);
    overlay.closeDialog();
  }, [controller, overlay]);

  const openPasteHtml = useCallback(() => {
    overlay.showPasteHtml(controller.iframeError || undefined);
  }, [controller.iframeError, overlay]);

  return (
    <>
      <ClientFrame
        frameUrl={iframeUrl}
        frameRef={controller.iframeRef}
        iframeProps={{
          id: 'annotated-frame',
          title: controller.title || 'Page being annotated',
          onLoad: controller.handleFrameLoad,
          onError: () => {
            const message = 'The proxied page could not be loaded.';
            controller.reportFrameError(message);
            overlay.showPasteHtml(message);
          },
          style: { width: '100%', height: '100dvh', border: 'none', display: 'block' },
        }}
      />

      <AnnotationContext
        initialAnnotations={controller.annotations}
        pageId={pageId}
        title={controller.title}
        pageUrl={pageUrl}
        contentRef={controller.contentRef as RefObject<HTMLElement>}
        iframeRef={controller.iframeRef as RefObject<HTMLIFrameElement>}
        iframeUrl={iframeUrl}
        iframeReady={controller.iframeReady}
      >
        <OverlayRoot>
          <WorkspaceLayer>
            <Sidebar
              open={overlay.panel.type === 'annotations'}
              onOpenChange={(open) => {
                if (open) overlay.openAnnotations();
                else overlay.closePanel();
              }}
              onPasteHTML={openPasteHtml}
            />
          </WorkspaceLayer>

          <ContextualLayer>
            <MenuOnRange />
            <MenuOnFocus />
          </ContextualLayer>

          <FeedbackLayer>
            {!controller.iframeReady && <Loader />}
            {controller.iframeError && !showPasteHtml && (
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
                <PromptBox
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
                <PasteHTML
                  error={overlay.dialog.type === 'pasteHtml' ? overlay.dialog.error : controller.iframeError}
                  site={pageUrl}
                  path={controller.framePath}
                  onSuccess={() => {
                    overlay.closeDialog();
                    controller.reloadFrame();
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
