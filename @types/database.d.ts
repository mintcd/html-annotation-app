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

type TextAnchor = {
  version: 1;
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
};

type Annotation = {
  id: string;
  page_id: string;
  text: string;
  html?: string | null;
  position: TextAnchor;
  color: string;
  comment?: string | null;
  created_at: string;
  updated_at: string;
}
