'use client';

import DynamicEngine from "@/components/DynamicEngine";

// 메타데이터 트리를 렌더링하는 얇은 이음새(seam).
// 컨트롤러들은 이 컴포넌트에 조합한 pageData/formData 를 넘겨 렌더한다.
export interface SduiRendererProps {
    screenId: string;
    metadata: any[];
    pageData: any;
    formData: any;
    setFormData: (updater: any) => void;
    onChange: (id: string, value: any) => void;
    onAction: (meta: any, data?: any) => void | Promise<any>;
    pwType?: string;
    showPassword?: boolean;
    activeModal?: any;
    closeModal?: () => void;
}

export default function SduiRenderer(props: SduiRendererProps) {
    return (
        <DynamicEngine
            screenId={props.screenId}
            metadata={props.metadata}
            pageData={props.pageData}
            formData={props.formData}
            setFormData={props.setFormData}
            onChange={props.onChange}
            onAction={props.onAction}
            pwType={props.pwType}
            showPassword={props.showPassword}
            activeModal={props.activeModal}
            closeModal={props.closeModal}
        />
    );
}
