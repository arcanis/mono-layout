export type Position = {
  x: number,
  y: number,
};

export type TextOperation = {
  startingRow: number,
  deletedLineCount: number,
  addedLineCount: number,
};

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

  getRowCount(): number;
  getColumnCount(): number;
  getSoftWrapCount(): number;
  getMaxCharacterCount(): number;

  getFirstPosition(): Position;
  getLastPosition(): Position;

  doesSoftWrap(row: number): boolean;

  getLineString(row: number): string;

  getSourceText(): string;
  getTransformedText(): string;

  getFixedPosition(position: Position): Position;

  getPositionLeft(position: Position): Position;
  getPositionRight(position: Position): Position;

  getPositionAbove(position: Position, amplitude: number): Position;
  getPositionBelow(position: Position, amplitude: number): Position;

  getRowForCharacterIndex(characterIndex: number): number;
  getCharacterIndexForRow(row: number): number;

  getPositionForCharacterIndex(characterIndex: number): Position;
  getCharacterIndexForPosition(position: Position): number;

  clearText(): TextOperation;
  setText(source: string): TextOperation;

  update(start: number, deleted: number, added: string): TextOperation;
}

export interface TextLayoutConstructor {
  new(): TextLayout;
}

export type TextLayoutStruct = {
  TextLayout: TextLayoutConstructor,
};
