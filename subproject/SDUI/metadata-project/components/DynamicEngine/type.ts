export interface Metadata {
    componentId?: string;
    component_id?: string;
    componentType?: string;
    component_type?: string;
    parentGroupId?: string | null;
    parent_group_id?: string | null;
    groupId?: string | null;
    group_id?: string | null;
    refDataId?: string;
    ref_data_id?: string;
    isVisible?: boolean | string;
    is_visible?: boolean | string;
    groupDirection?: "ROW" | "COLUMN";
    group_direction?: "ROW" | "COLUMN";
    cssClass?: string;
    css_class?: string;
    inlineStyle?: any;
    inline_style?: any;
    actionType?: string;
    action_type?: string;
    placeholder?: string;
    uiId?: string;
    ui_id?: string;
    labelText?: string;
    label_text?: string;
    isReadonly?: boolean | string;
    is_readonly?: boolean | string;
    dataSqlKey?: string;
    data_sql_key?: string;
    dataParams?: any;
    data_params?: any;
    children?: Metadata[] | null;
    [key: string]: any;
}

export interface NormalizedNode {
    componentId?: string;
    componentType?: string;
    parentGroupId?: string | null;
    groupId?: string | null;
    refDataId?: string;
    isVisible?: boolean | string;
    groupDirection?: "ROW" | "COLUMN";
    cssClass?: string;
    inlineStyle?: any;
    actionType?: string;
    placeholder?: string;
    uiId?: string;
    labelText?: string;
    isReadonly?: boolean | string;
    dataSqlKey?: string;
    dataParams?: any;
    children?: NormalizedNode[] | null;
    [key: string]: any;
}

export interface DynamicEngineProps {
    metadata: Metadata[];
    screenId: string;
    pageData: any;
    formData: any;
    setFormData?: (value: any | ((prev: any) => any)) => void;
    onChange: (id: string, value: any) => void;
    onAction: (meta: NormalizedNode, data?: any) => void;
    activeModal?: string | null;
    closeModal?: () => void;
    onConfirmModal?: () => void;
    pwType?: string;
    showPassword?: boolean;
    [key: string]: any;
}
