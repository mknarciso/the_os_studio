import { Annotation } from '@langchain/langgraph';

export type UiAction = 'init_db' | 'update_from_file' | 'list_all' | 'update_all';

export type UiInput = {
  action: UiAction;
  namespace: string;
  app: string;
  filePath?: string;
};

export type UiStateShape = {
  input: UiInput;
  result?: any;
};

export const UiState = Annotation.Root({
  input: Annotation<UiInput>(),
  result: Annotation<any>(),
});



