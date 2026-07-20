export interface AnnotationPage {
  url: string;
  filename: string;
  timestamp: string;
  title?: string;
  siteTitle?: string;
  siteLogoSrc?: string;
  count: number;
  annotations: Annotation[];
  pageNote: PageNote | null;
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
  logoSrc?: string;
  pages: AnnotationPage[];
};
