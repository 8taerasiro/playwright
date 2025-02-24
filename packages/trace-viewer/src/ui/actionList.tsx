/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { ActionTraceEvent } from '@trace/trace';
import { msToString } from '@web/uiUtils';
import * as React from 'react';
import './actionList.css';
import * as modelUtil from './modelUtil';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';
import type { TreeState } from '@web/components/treeView';
import { TreeView } from '@web/components/treeView';

export interface ActionListProps {
  actions: ActionTraceEvent[],
  selectedAction: ActionTraceEvent | undefined,
  sdkLanguage: Language | undefined;
  onSelected: (action: ActionTraceEvent) => void,
  onHighlighted: (action: ActionTraceEvent | undefined) => void,
  revealConsole: () => void,
  isLive?: boolean,
}

type ActionTreeItem = {
  id: string;
  children: ActionTreeItem[];
  parent: ActionTreeItem | undefined;
  action?: ActionTraceEvent;
};

const ActionTreeView = TreeView<ActionTreeItem>;

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  selectedAction,
  sdkLanguage,
  onSelected,
  onHighlighted,
  revealConsole,
  isLive,
}) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const { rootItem, itemMap } = React.useMemo(() => {
    const itemMap = new Map<string, ActionTreeItem>();

    for (const action of actions) {
      itemMap.set(action.callId, {
        id: action.callId,
        parent: undefined,
        children: [],
        action,
      });
    }

    const rootItem: ActionTreeItem = { id: '', parent: undefined, children: [] };
    for (const item of itemMap.values()) {
      const parent = item.action!.parentId ? itemMap.get(item.action!.parentId) || rootItem : rootItem;
      parent.children.push(item);
      item.parent = parent;
    }
    return { rootItem, itemMap };
  }, [actions]);

  const { selectedItem } = React.useMemo(() => {
    const selectedItem = selectedAction ? itemMap.get(selectedAction.callId) : undefined;
    return { selectedItem };
  }, [itemMap, selectedAction]);

  return <ActionTreeView
    dataTestId='action-list'
    rootItem={rootItem}
    treeState={treeState}
    setTreeState={setTreeState}
    selectedItem={selectedItem}
    onSelected={item => onSelected(item.action!)}
    onHighlighted={item => onHighlighted(item?.action)}
    isError={item => !!item.action?.error?.message}
    render={item => renderAction(item.action!, sdkLanguage, revealConsole, isLive || false)}
  />;
};

const renderAction = (
  action: ActionTraceEvent,
  sdkLanguage: Language | undefined,
  revealConsole: () => void,
  isLive: boolean,
) => {
  const { errors, warnings } = modelUtil.stats(action);
  const locator = action.params.selector ? asLocator(sdkLanguage || 'javascript', action.params.selector, false /* isFrameLocator */, true /* playSafe */) : undefined;

  let time: string = '';
  if (action.endTime)
    time = msToString(action.endTime - action.startTime);
  else if (action.error)
    time = 'Timed out';
  else if (!isLive)
    time = '-';
  return <>
    <div className='action-title'>
      <span>{action.apiName}</span>
      {locator && <div className='action-selector' title={locator}>{locator}</div>}
      {action.method === 'goto' && action.params.url && <div className='action-url' title={action.params.url}>{action.params.url}</div>}
    </div>
    <div className='action-duration' style={{ flex: 'none' }}>{time || <span className='codicon codicon-loading'></span>}</div>
    <div className='action-icons' onClick={() => revealConsole()}>
      {!!errors && <div className='action-icon'><span className='codicon codicon-error'></span><span className="action-icon-value">{errors}</span></div>}
      {!!warnings && <div className='action-icon'><span className='codicon codicon-warning'></span><span className="action-icon-value">{warnings}</span></div>}
    </div>
  </>;
};
