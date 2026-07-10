type Website = {
  id: string;
  origin: string;
  created_at: string;
  updated_at: string;
}

type Page = {
  id: string;
  url: string;
  title: string;
  number_of_scripts: number;
  number_of_annotations: number;
  created_at: string;
  updated_at: string;
}

type LegacyAnnotationPosition = {
  startPosition: number;
  endPosition: number;
  startOffset: number;
  endOffset: number;
};

type TextAnchor = {
  version: 1;
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
};

type AnnotationPosition = LegacyAnnotationPosition | TextAnchor;

type Annotation = {
  id: string;
  page_id: string;
  text: string;
  html?: string | null;
  position?: AnnotationPosition;
  color: string;
  comment?: string | null;
  created_at: string;
  updated_at: string;
}
