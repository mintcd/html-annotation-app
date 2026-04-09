type ScriptItem = {
  src?: string;
  content?: string;
  type?: string;
  async?: boolean;
  defer?: boolean;
  location?: 'head' | 'body'
}

