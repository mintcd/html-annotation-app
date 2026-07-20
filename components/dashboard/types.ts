export interface AnnotationPage {
  url: string;
  filename: string;
  timestamp: string;
  title?: string;
  count: number;
  annotations: Annotation[];
  blobUrl: string;
  uploadedAt: string;
}

export type EditingCommentState = {
  pageUrl: string;
  annotationId: string;
  comment: string;
};

export type PageGroup = {
  key: string;
  label: string;
  pages: AnnotationPage[];
};
