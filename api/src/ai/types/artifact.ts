export type ZazArtifactType = 'documentation' | 'generic' | string;
export type ZazActionType = 'editDocumentation' | 'createDocumentation' | string;

export interface ZazAction {
  id: string;
  type: ZazActionType;
  status: 'running' | 'complete' | 'error' | string;
  content: string;
  context?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ZazArtifact {
  id: string;
  title: string;
  type: ZazArtifactType;
  status: 'pending' | 'complete' | 'error' | string;
  actions: ZazAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ParserCallbacks {
  onArtifactOpen?: (artifact: Partial<ZazArtifact>) => void;
  onArtifactClose?: (artifact: Partial<ZazArtifact>) => void;
  onActionOpen?: (action: Partial<ZazAction>) => void;
  onActionStream?: (action: Partial<ZazAction>, chunk: string) => void;
  onActionClose?: (action: Partial<ZazAction>) => void;
}



