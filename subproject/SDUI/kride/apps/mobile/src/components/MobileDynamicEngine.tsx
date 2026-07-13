import { useMemo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Metadata } from '@kride/core';

type Props = { metadata: Metadata[]; pageData?: any; onAction?: (meta: Metadata, data?: any) => void };

export default function MobileDynamicEngine({ metadata, pageData = {}, onAction }: Props) {
  const nodes = useMemo(() => metadata ?? [], [metadata]);
  const render = (items: Metadata[], rowData?: any): ReactNode => items.map((node, index) => {
    if (node.isVisible === false || node.is_visible === false || node.isVisible === 'false' || node.is_visible === 'false') return null;
    const type = String(node.componentType || node.component_type || '').toUpperCase();
    const id = String(node.componentId || node.component_id || node.uiId || index);
    const data = rowData ?? pageData?.[node.refDataId || node.ref_data_id || ''] ?? pageData;
    const children = node.children ?? [];
    if (children.length || type === 'GROUP') {
      const direction = node.groupDirection === 'ROW' ? 'flex-row' : 'flex-col';
      const content = render(children, rowData);
      return <View key={id} className={`${direction} ${node.cssClass || node.css_class || ''}`}><>{content}</></View>;
    }
    if (type === 'TEXT' || type === 'LABEL') {
      const value = node.labelText || node.label_text || data?.[node.dataKey || node.data_key] || node.placeholder || '';
      return <Text key={id} className={node.cssClass || node.css_class || 'text-base text-gray-900'}>{String(value)}</Text>;
    }
    if (type === 'BUTTON' || type === 'CTA') {
      const label = node.labelText || node.label_text || node.text || '확인';
      return <Pressable key={id} className={`rounded-xl bg-kride px-4 py-3 ${node.cssClass || node.css_class || ''}`} onPress={() => onAction?.(node, data)}><Text className="text-center font-bold text-white">{String(label)}</Text></Pressable>;
    }
    return null;
  });
  return <View className="w-full gap-3">{render(nodes)}</View>;
}
