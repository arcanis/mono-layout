export type Configuration = {
  columns: number;
  tabWidth: number;

  softWrap: boolean;
  collapseWhitespaces: boolean;
  preserveLeadingSpaces: boolean;
  preserveTrailingSpaces: boolean;
  allowWordBreaks: boolean;
  demoteNewlines: boolean;
  justifyText: boolean;
};

export type Position = {
  x: number;
  y: number;
};

export type TextOperation = {
  startingRow: number;
  deletedLineCount: number;
  addedLineCount: number;
};

export interface Context {
  createLayout(): TextLayout;
}

export interface TextLayout {
  getColumns(): number;
  getTabWidth(): number;

  getSoftWrap(): boolean;
  getCollapseWhitespaces(): boolean;
  getPreserveLeadingSpaces(): boolean;
  getPreserveTrailingSpaces(): boolean;
  getAllowWordBreaks(): boolean;
  getDemoteNewlines(): boolean;
  getJustifyText(): boolean;

  setColumns(columns: number): boolean;
  setTabWidth(tabWidth: number): boolean;

  setSoftWrap(softWrap: boolean): boolean;
  setCollapseWhitespaces(collapseWhitespaces: boolean): boolean;
  setPreserveLeadingSpaces(preserveLeadingSpaces: boolean): boolean;
  setPreserveTrailingSpaces(preserveTrailingSpaces: boolean): boolean;
  setAllowWordBreaks(allowWordBreaks: boolean): boolean;
  setDemoteNewlines(demoteNewlines: boolean): boolean;
  setJustifyText(justifyText: boolean): boolean;

  setConfiguration(configuration: Partial<Configuration>): boolean;

  getRowCount(): number;
  getColumnCount(): number;
  getSoftWrapCount(): number;
  getMaxCharacterIndex(): number;

  getFirstPosition(): Position;
  getLastPosition(): Position;

  doesSoftWrap(row: number): boolean;

  getSource(): string;
  getText(): string;
  getLine(row: number): string;
  getLineLength(row: number): number;
  getLineSlice(row: number, start: number, end: number): string;

  getFixedCellPosition(position: Position): Position;
  getFixedPosition(position: Position): Position;

  getPositionLeft(position: Position): [Position, boolean];
  getPositionRight(position: Position): [Position, boolean];

  getPositionAbove(position: Position, amplitude?: number): [Position, boolean];
  getPositionBelow(position: Position, amplitude?: number): [Position, boolean];

  getRowForCharacterIndex(characterIndex: number): number;
  getCharacterIndexForRow(row: number): number;

  getPositionForCharacterIndex(characterIndex: number): Position;
  getCharacterIndexForPosition(position: Position): number;

  clearSource(): TextOperation;
  setSource(source: string): TextOperation;
  spliceSource(start: number, deleted: number, added: string): TextOperation;

  [Symbol.iterator](): IterableIterator<string>;
}
